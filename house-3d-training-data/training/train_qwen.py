#!/usr/bin/env python
"""Fine-Tuning Script: Fine-tunes Qwen2.5/Qwen3 models on 3D spatial reasoning dataset via QLoRA.

Uses Hugging Face transformers, PEFT, BitsAndBytes, and TRL SFTTrainer.
Includes a dry-run/verification mode for local setup testing without requiring a GPU.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("train_qwen")


def verify_dataset(dataset_path: Path) -> int:
    """Verify JSONL dataset formatting and count samples."""
    if not dataset_path.is_file():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

    lines = dataset_path.read_text(encoding="utf-8").splitlines()
    count = 0
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        data = json.loads(line)
        if "messages" not in data or len(data["messages"]) < 2:
            raise ValueError(f"Line {i+1} missing required 'messages' structure")
        count += 1
    return count


def run_training(
    base_model: str,
    dataset_path: Path,
    output_dir: Path,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    dry_run: bool = False
) -> None:
    """Run QLoRA SFT training loop or dry-run simulation."""
    logger.info(f"Validating dataset at: {dataset_path}")
    sample_count = verify_dataset(dataset_path)
    logger.info(f"Successfully validated {sample_count} samples in dataset.")

    if dry_run:
        logger.info("--- DRY RUN MODE ---")
        logger.info(f"Base model: {base_model}")
        logger.info(f"Target dataset: {dataset_path} ({sample_count} rows)")
        logger.info(f"Output checkpoints dir: {output_dir}")
        logger.info(f"Hyperparameters: epochs={epochs}, batch_size={batch_size}, lr={learning_rate}")
        logger.info("Validation check passed. Ready for GPU training run!")
        return

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer, SFTConfig
        from datasets import load_dataset
    except ImportError as exc:
        logger.error(
            f"Missing training dependencies: {exc}.\n"
            "Please install required packages: pip install torch transformers peft trl bitsandbytes datasets"
        )
        sys.exit(1)

    logger.info(f"Loading tokenizer & model {base_model}...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    dataset = load_dataset("json", data_files=str(dataset_path), split="train")

    training_args = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        logging_steps=10,
        save_strategy="epoch",
        fp16=False,
        bf16=torch.cuda.is_bf16_supported(),
        dataset_text_field="messages",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=peft_config,
        args=training_args,
        tokenizer=tokenizer,
    )

    logger.info("Starting QLoRA Fine-tuning...")
    trainer.train()

    final_adapter_dir = output_dir / "final_adapter"
    trainer.model.save_pretrained(final_adapter_dir)
    tokenizer.save_pretrained(final_adapter_dir)
    logger.info(f"Fine-tuning complete! Adapter saved to {final_adapter_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base_model", default="Qwen/Qwen2.5-Coder-7B-Instruct", help="Hugging Face base model tag")
    parser.add_argument("--dataset_path", default="datasets/house/processed/qwen_reasoning_train.jsonl")
    parser.add_argument("--output_dir", default="training/checkpoints/qwen_house_3d")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=2)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--dry_run", action="store_true", help="Validate dataset and print config without GPU execution")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    dataset_p = Path(args.dataset_path)
    if not dataset_p.is_absolute():
        if (project_root / dataset_p).is_file():
            dataset_p = project_root / dataset_p
        else:
            dataset_p = dataset_p.resolve()

    output_p = Path(args.output_dir)
    if not output_p.is_absolute():
        output_p = project_root / output_p

    run_training(
        base_model=args.base_model,
        dataset_path=dataset_p,
        output_dir=output_p,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
