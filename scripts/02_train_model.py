"""
ไฟล์สำหรับ Fine-tune โมเดล
"""
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_from_disk
import os

class LLMFineTuner:
    def __init__(self, model_name, output_dir):
        self.model_name = model_name
        self.output_dir = output_dir
        self.tokenizer = None
        self.model = None
        
    def load_model(self):
        """โหลดโมเดลและ tokenizer"""
        print(f"Loading model: {self.model_name}")
        
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"
        
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            load_in_8bit=True,
            device_map="auto",
            torch_dtype=torch.float16,
        )
        
        print("Model loaded successfully!")
        
    def setup_lora(self):
        """ตั้งค่า LoRA"""
        self.model = prepare_model_for_kbit_training(self.model)
        
        lora_config = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )
        
        self.model = get_peft_model(self.model, lora_config)
        self.model.print_trainable_parameters()
        
    def tokenize_dataset(self, dataset):
        """Tokenize dataset"""
        def tokenize_function(examples):
            result = self.tokenizer(
                examples["text"],
                truncation=True,
                max_length=512,
                padding="max_length",
            )
            result["labels"] = result["input_ids"].copy()
            return result
        
        tokenized = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=dataset["train"].column_names
        )
        return tokenized
    
    def train(self, train_dataset, eval_dataset, num_epochs=3):
        """เทรนโมเดล"""
        training_args = TrainingArguments(
            output_dir=self.output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=4,
            per_device_eval_batch_size=4,
            gradient_accumulation_steps=4,
            warmup_steps=100,
            learning_rate=2e-4,
            fp16=True,
            logging_steps=10,
            evaluation_strategy="steps",
            eval_steps=50,
            save_steps=100,
            save_total_limit=2,
            load_best_model_at_end=True,
        )
        
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False
        )
        
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
        )
        
        print("Starting training...")
        trainer.train()
        
        # บันทึกโมเดล
        trainer.save_model(os.path.join(self.output_dir, "final_model"))
        self.tokenizer.save_pretrained(os.path.join(self.output_dir, "final_model"))
        print("Training completed!")

def main():
    # โหลด dataset
    dataset = load_from_disk("data/processed_dataset")
    
    # สร้าง fine-tuner
    fine_tuner = LLMFineTuner(
        model_name="meta-llama/Llama-2-7b-hf",
        output_dir="./results"
    )
    
    # โหลดโมเดล
    fine_tuner.load_model()
    fine_tuner.setup_lora()
    
    # Tokenize dataset
    tokenized_dataset = fine_tuner.tokenize_dataset(dataset)
    
    # เทรน
    fine_tuner.train(
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        num_epochs=3
    )

if __name__ == "__main__":
    main()