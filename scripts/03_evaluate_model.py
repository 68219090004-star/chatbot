"""
ไฟล์สำหรับประเมินประสิทธิภาพของโมเดลที่เทรนแล้ว
"""
import torch
import json
import numpy as np
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from datasets import load_from_disk, load_metric
from tqdm import tqdm
import pandas as pd
from datetime import datetime
import os

class ModelEvaluator:
    def __init__(self, base_model_name, adapter_path, output_dir="./evaluation_results"):
        """
        Initialize Model Evaluator
        
        Args:
            base_model_name: ชื่อโมเดลฐาน
            adapter_path: path ของ LoRA adapter ที่เทรนแล้ว
            output_dir: directory สำหรับบันทึกผลการประเมิน
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        print("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(adapter_path)
        
        print("Loading base model...")
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            load_in_8bit=True,
            device_map="auto",
            torch_dtype=torch.float16,
        )
        
        print("Loading fine-tuned adapter...")
        self.model = PeftModel.from_pretrained(base_model, adapter_path)
        self.model.eval()
        
        print("Model loaded successfully!")
        
    def generate_response(self, instruction, input_text, max_tokens=256, temperature=0.7):
        """
        Generate response จากโมเดล
        """
        prompt = f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input_text}

### Response:
"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to("cuda")
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        
        full_response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = full_response.split("### Response:")[-1].strip()
        return response
    
    def calculate_perplexity(self, text):
        """
        คำนวณ perplexity ของ text
        Perplexity ต่ำ = โมเดลมั่นใจในการ predict
        """
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to("cuda")
        
        with torch.no_grad():
            outputs = self.model(**inputs, labels=inputs["input_ids"])
            loss = outputs.loss
            perplexity = torch.exp(loss)
        
        return perplexity.item()
    
    def evaluate_on_dataset(self, test_dataset, num_samples=None):
        """
        ประเมินโมเดลบน test dataset
        
        Args:
            test_dataset: dataset สำหรับทดสอบ
            num_samples: จำนวน sample ที่จะประเมิน (None = ทั้งหมด)
        """
        results = []
        
        # โหลดข้อมูล
        if isinstance(test_dataset, str):
            dataset = load_from_disk(test_dataset)
            if "test" in dataset:
                dataset = dataset["test"]
        else:
            dataset = test_dataset
        
        # จำกัดจำนวน samples ถ้าต้องการ
        if num_samples:
            dataset = dataset.select(range(min(num_samples, len(dataset))))
        
        print(f"\nEvaluating on {len(dataset)} samples...")
        
        for idx, sample in enumerate(tqdm(dataset)):
            # Extract instruction, input, expected output
            text = sample["text"]
            parts = text.split("### ")
            
            instruction = ""
            input_text = ""
            expected_output = ""
            
            for part in parts:
                if part.startswith("Instruction:"):
                    instruction = part.replace("Instruction:", "").strip()
                elif part.startswith("Input:"):
                    input_text = part.replace("Input:", "").strip()
                elif part.startswith("Response:"):
                    expected_output = part.replace("Response:", "").strip()
            
            # Generate prediction
            predicted_output = self.generate_response(instruction, input_text)
            
            # Calculate perplexity
            perplexity = self.calculate_perplexity(text)
            
            # เก็บผลลัพธ์
            results.append({
                "sample_id": idx,
                "instruction": instruction,
                "input": input_text,
                "expected_output": expected_output,
                "predicted_output": predicted_output,
                "perplexity": perplexity,
            })
        
        return results
    
    def calculate_metrics(self, results):
        """
        คำนวณ metrics ต่างๆ จากผลการประเมิน
        """
        metrics = {}
        
        # Average Perplexity
        perplexities = [r["perplexity"] for r in results]
        metrics["avg_perplexity"] = np.mean(perplexities)
        metrics["std_perplexity"] = np.std(perplexities)
        metrics["min_perplexity"] = np.min(perplexities)
        metrics["max_perplexity"] = np.max(perplexities)
        
        # Response Length Statistics
        pred_lengths = [len(r["predicted_output"].split()) for r in results]
        expected_lengths = [len(r["expected_output"].split()) for r in results]
        
        metrics["avg_pred_length"] = np.mean(pred_lengths)
        metrics["avg_expected_length"] = np.mean(expected_lengths)
        
        # คำนวณ BLEU score (ถ้าต้องการ - ต้อง install sacrebleu)
        try:
            from sacrebleu import corpus_bleu
            predictions = [r["predicted_output"] for r in results]
            references = [[r["expected_output"]] for r in results]
            bleu = corpus_bleu(predictions, references)
            metrics["bleu_score"] = bleu.score
        except ImportError:
            print("Warning: sacrebleu not installed. Skipping BLEU score calculation.")
            metrics["bleu_score"] = None
        
        # คำนวณ ROUGE score (ถ้าต้องการ - ต้อง install rouge-score)
        try:
            from rouge_score import rouge_scorer
            scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
            
            rouge1_scores = []
            rouge2_scores = []
            rougeL_scores = []
            
            for result in results:
                scores = scorer.score(result["expected_output"], result["predicted_output"])
                rouge1_scores.append(scores['rouge1'].fmeasure)
                rouge2_scores.append(scores['rouge2'].fmeasure)
                rougeL_scores.append(scores['rougeL'].fmeasure)
            
            metrics["rouge1"] = np.mean(rouge1_scores)
            metrics["rouge2"] = np.mean(rouge2_scores)
            metrics["rougeL"] = np.mean(rougeL_scores)
        except ImportError:
            print("Warning: rouge-score not installed. Skipping ROUGE score calculation.")
            metrics["rouge1"] = None
            metrics["rouge2"] = None
            metrics["rougeL"] = None
        
        return metrics
    
    def manual_evaluation_samples(self, results, num_samples=5):
        """
        แสดงตัวอย่าง samples สำหรับการประเมินด้วยตาเอง
        """
        print("\n" + "="*80)
        print(f"SAMPLE PREDICTIONS (showing {num_samples} samples)")
        print("="*80)
        
        # สุ่มเลือก samples
        indices = np.random.choice(len(results), min(num_samples, len(results)), replace=False)
        
        for i, idx in enumerate(indices):
            result = results[idx]
            print(f"\n--- Sample {i+1} (ID: {result['sample_id']}) ---")
            print(f"\nInstruction: {result['instruction']}")
            print(f"\nInput: {result['input']}")
            print(f"\nExpected Output:\n{result['expected_output']}")
            print(f"\nPredicted Output:\n{result['predicted_output']}")
            print(f"\nPerplexity: {result['perplexity']:.2f}")
            print("-" * 80)
    
    def save_results(self, results, metrics, filename_prefix="evaluation"):
        """
        บันทึกผลการประเมิน
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # บันทึกผล results ทั้งหมด
        results_df = pd.DataFrame(results)
        results_file = os.path.join(self.output_dir, f"{filename_prefix}_results_{timestamp}.csv")
        results_df.to_csv(results_file, index=False, encoding='utf-8-sig')
        print(f"\nResults saved to: {results_file}")
        
        # บันทึก metrics
        metrics_file = os.path.join(self.output_dir, f"{filename_prefix}_metrics_{timestamp}.json")
        with open(metrics_file, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        print(f"Metrics saved to: {metrics_file}")
        
        # สร้างรายงานสรุป
        report_file = os.path.join(self.output_dir, f"{filename_prefix}_report_{timestamp}.txt")
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("MODEL EVALUATION REPORT\n")
            f.write("="*80 + "\n\n")
            f.write(f"Evaluation Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Number of Samples: {len(results)}\n\n")
            
            f.write("METRICS:\n")
            f.write("-"*80 + "\n")
            for key, value in metrics.items():
                if value is not None:
                    if isinstance(value, float):
                        f.write(f"{key}: {value:.4f}\n")
                    else:
                        f.write(f"{key}: {value}\n")
            
            f.write("\n" + "="*80 + "\n")
            f.write("SAMPLE PREDICTIONS\n")
            f.write("="*80 + "\n\n")
            
            # เพิ่มตัวอย่าง 5 samples
            for i, result in enumerate(results[:5]):
                f.write(f"\n--- Sample {i+1} ---\n")
                f.write(f"Instruction: {result['instruction']}\n")
                f.write(f"Input: {result['input']}\n")
                f.write(f"Expected: {result['expected_output']}\n")
                f.write(f"Predicted: {result['predicted_output']}\n")
                f.write(f"Perplexity: {result['perplexity']:.2f}\n")
                f.write("-"*80 + "\n")
        
        print(f"Report saved to: {report_file}")
        
        return results_file, metrics_file, report_file
    
    def print_metrics_summary(self, metrics):
        """
        แสดงสรุป metrics
        """
        print("\n" + "="*80)
        print("EVALUATION METRICS SUMMARY")
        print("="*80)
        
        print(f"\nPerplexity:")
        print(f"  Average: {metrics['avg_perplexity']:.4f}")
        print(f"  Std Dev: {metrics['std_perplexity']:.4f}")
        print(f"  Min: {metrics['min_perplexity']:.4f}")
        print(f"  Max: {metrics['max_perplexity']:.4f}")
        
        print(f"\nResponse Length:")
        print(f"  Avg Predicted: {metrics['avg_pred_length']:.2f} words")
        print(f"  Avg Expected: {metrics['avg_expected_length']:.2f} words")
        
        if metrics.get('bleu_score'):
            print(f"\nBLEU Score: {metrics['bleu_score']:.4f}")
        
        if metrics.get('rouge1'):
            print(f"\nROUGE Scores:")
            print(f"  ROUGE-1: {metrics['rouge1']:.4f}")
            print(f"  ROUGE-2: {metrics['rouge2']:.4f}")
            print(f"  ROUGE-L: {metrics['rougeL']:.4f}")
        
        print("="*80 + "\n")


def main():
    """
    Main function สำหรับรัน evaluation
    """
    # Configuration
    BASE_MODEL = "meta-llama/Llama-2-7b-hf"  # เปลี่ยนตามโมเดลที่ใช้
    ADAPTER_PATH = "./results/final_model"    # path ของโมเดลที่เทรนแล้ว
    TEST_DATASET_PATH = "data/processed_dataset"  # path ของ test dataset
    NUM_SAMPLES = 100  # จำนวน samples ที่จะประเมิน (None = ทั้งหมด)
    
    # สร้าง evaluator
    evaluator = ModelEvaluator(
        base_model_name=BASE_MODEL,
        adapter_path=ADAPTER_PATH,
        output_dir="./evaluation_results"
    )
    
    # ประเมินโมเดล
    print("\nStarting evaluation...")
    results = evaluator.evaluate_on_dataset(
        test_dataset=TEST_DATASET_PATH,
        num_samples=NUM_SAMPLES
    )
    
    # คำนวณ metrics
    print("\nCalculating metrics...")
    metrics = evaluator.calculate_metrics(results)
    
    # แสดงสรุป metrics
    evaluator.print_metrics_summary(metrics)
    
    # แสดงตัวอย่าง predictions
    evaluator.manual_evaluation_samples(results, num_samples=5)
    
    # บันทึกผลลัพธ์
    print("\nSaving results...")
    evaluator.save_results(results, metrics, filename_prefix="model_evaluation")
    
    print("\nEvaluation completed!")


if __name__ == "__main__":
    main()