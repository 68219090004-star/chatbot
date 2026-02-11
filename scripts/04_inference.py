"""
ไฟล์สำหรับทดสอบโมเดลที่เทรนแล้ว
"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

class ChatBot:
    def __init__(self, base_model_name, adapter_path):
        self.tokenizer = AutoTokenizer.from_pretrained(adapter_path)
        
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            load_in_8bit=True,
            device_map="auto",
        )
        
        self.model = PeftModel.from_pretrained(base_model, adapter_path)
        self.model.eval()
        
    def generate_response(self, instruction, input_text, max_tokens=256):
        """Generate response"""
        prompt = f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input_text}

### Response:
"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt").to("cuda")
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("### Response:")[-1].strip()
        return response

def main():
    # โหลดโมเดล
    chatbot = ChatBot(
        base_model_name="meta-llama/Llama-2-7b-hf",
        adapter_path="./results/final_model"
    )
    
    # ทดสอบ
    while True:
        print("\n" + "="*50)
        instruction = input("Instruction: ")
        if instruction.lower() == 'quit':
            break
            
        user_input = input("Input: ")
        
        response = chatbot.generate_response(instruction, user_input)
        print(f"\nResponse: {response}")

if __name__ == "__main__":
    main()