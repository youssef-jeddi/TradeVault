import json
import os
import sys
import traceback
import importlib.util
from typing import Any, Dict, Optional

# Helper to read from protected Zip
import protected_data 

# =============================================================================
# Configuration
# =============================================================================
IEXEC_OUT = os.getenv("IEXEC_OUT", "/iexec_out")
IEXEC_IN = os.getenv("IEXEC_IN", "/iexec_in")
IEXEC_DATASET_FILENAME = os.getenv("IEXEC_DATASET_FILENAME", "")


# =============================================================================
# Output Helpers
# =============================================================================
def write_outputs(result_obj: Dict[str, Any]) -> None:
    """Write result.json and computed.json"""
    os.makedirs(IEXEC_OUT, exist_ok=True)
    result_path = os.path.join(IEXEC_OUT, "result.json")
    
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result_obj, f, indent=2)
        
    with open(os.path.join(IEXEC_OUT, "computed.json"), "w", encoding="utf-8") as f:
        json.dump({"deterministic-output-path": result_path}, f)

def write_error(message: str) -> None:
    err_obj = {
        "status": "error",
        "error": message,
        "timestamp": 0 # timestamp isn't critical for error
    }
    write_outputs(err_obj)

# =============================================================================
# Dynamic Strategy Loader
# =============================================================================
def load_strategy_module() -> Any:
    """
    Extracts 'target_code' from the protected data
    and loads it as a Python module.
    """
    try:
        import zipfile
        
        # 1. Get the raw zip bytes from protected data
        # 'zipfile' is the key in protected data schema, 'file' returns bytes
        code_bytes = protected_data.getValue('zipfile', 'file')

        if not code_bytes:
             raise ValueError("protected_data returned empty content for 'zipfile'")
        
        # 2. Write to a temporary zip file
        extraction_path = "/tmp/strategy_exec"
        if os.name == 'nt':
             extraction_path = ".\\tmp_strategy_exec"
        
        os.makedirs(extraction_path, exist_ok=True)
        zip_path = os.path.join(extraction_path, "strategy.zip")
        
        with open(zip_path, "wb") as f:
            f.write(code_bytes)
            
        # 3. Extract Zip
        target_file = None
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extraction_path)
            file_names = zip_ref.namelist()
            # Look for strategy.py or any .py file
            target_file = next((f for f in file_names if f.endswith('strategy.py')), None)
            if not target_file:
                 # Fallback to any python file if strategy.py not found
                 target_file = next((f for f in file_names if f.endswith('.py') and not f.startswith('__')), None)
        
        if not target_file:
            raise FileNotFoundError("No valid python strategy file found in protected zip")

        # 4. Import the module
        full_path = os.path.join(extraction_path, target_file)
        spec = importlib.util.spec_from_file_location("strategy", full_path)
        if not spec or not spec.loader:
            raise ImportError(f"Could not create module spec for {target_file}")
        
        strategy_module = importlib.util.module_from_spec(spec)
        sys.modules["strategy"] = strategy_module
        spec.loader.exec_module(strategy_module)
        
        return strategy_module

    except Exception as e:
        traceback.print_exc()
        raise RuntimeError(f"Failed to load strategy from protected zip: {e}")

# =============================================================================
# Main
# =============================================================================
def main():
    try:
        # 1. Parse Arguments (passed via IEXEC_APP_ARGS or similar, but here 
        #    we expect the 'shim' or the environment to pass them.
        #    In standard iExec apps, args are in sys.argv[1:]
        #    We expect JSON string as first arg for complex inputs like {wallet, amount}
        #    OR separate flags. Let's support a JSON string in argv[1]
        
        user_args = {}
        if len(sys.argv) > 1:
            try:
                # Attempt to join all arguments in case they were split by spaces
                raw_arg = " ".join(sys.argv[1:])
                # Cleaning quotes if needed (sometimes shell passing wrapper adds them)
                if raw_arg.startswith("'") and raw_arg.endswith("'"):
                    raw_arg = raw_arg[1:-1]
                # Also handle double quotes wrapper if present
                if raw_arg.startswith('"') and raw_arg.endswith('"'):
                    raw_arg = raw_arg[1:-1]
                
                # Manual parsing (Robust to missing quotes)
                content = raw_arg.strip()
                if content.startswith("{") and content.endswith("}"):
                    content = content[1:-1]
                
                items = content.split(',')
                for item in items:
                    if ':' in item:
                        key, val = item.split(':', 1)
                        k = key.strip()
                        v = val.strip()
                        
                        # Remove formatting quotes if present (handles "key": "val" style)
                        if (k.startswith('"') and k.endswith('"')) or (k.startswith("'") and k.endswith("'")):
                            k = k[1:-1]
                        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                            v = v[1:-1]
                            
                        user_args[k] = v
                        
            except Exception as e:
                 print(f"Warning: Failed to parse arguments: {e}")
                 # Fallback to defaults
                 pass
        
        # 2. Extract specific known params
        user_address = user_args.get("user_address") or user_args.get("wallet") or "0x0000000000000000000000000000000000000000"
        amount = int(user_args.get("amount", 0))
        
        print(f"Running strategy for {user_address} with amount {amount}")

        # 3. Load Strategy
        strategy = load_strategy_module()
        
        # 4. Execute
        if not hasattr(strategy, "generate_calldata"):
            raise AttributeError("strategy.py must implement 'generate_calldata(user_address, amount)'")
            
        result = strategy.generate_calldata(user_address, amount)
        
        # 5. Format Output
        output = {
            "status": "success",
            "action": result, # Expected { target_contract, calldata, value, chain_id, ... }
            "message": result.get("description", "Strategy Executed Successfully")
        }
        
        write_outputs(output)
        
    except Exception as e:
        traceback.print_exc()
        write_error(str(e))

if __name__ == "__main__":
    main()
