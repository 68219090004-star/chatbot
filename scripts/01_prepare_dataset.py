"""
ไฟล์สำหรับเตรียมข้อมูลสำหรับการเทรน
"""
import json
from datasets import Dataset, DatasetDict

def load_raw_data(filepath):
    """โหลดข้อมูลดิบ"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def format_instruction(sample):
    """แปลงข้อมูลเป็น instruction format"""
    return f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{sample['instruction']}

### Input:
{sample['input']}

### Response:
{sample['output']}"""

def prepare_dataset(raw_data_path, output_path):
    """เตรียม dataset"""
    # โหลดข้อมูล
    raw_data = load_raw_data(raw_data_path)
    
    # Format data
    formatted_data = [{"text": format_instruction(item)} for item in raw_data]
    
    # สร้าง dataset
    dataset = Dataset.from_list(formatted_data)
    
    # แบ่ง train/validation
    dataset = dataset.train_test_split(test_size=0.1, seed=42)
    
    # บันทึก
    dataset.save_to_disk(output_path)
    print(f"Dataset saved to {output_path}")
    print(f"Train samples: {len(dataset['train'])}")
    print(f"Validation samples: {len(dataset['test'])}")
    
    return dataset

if __name__ == "__main__":
    dataset = prepare_dataset(
        raw_data_path="data/raw_data.json",
        output_path="data/processed_dataset"
    )