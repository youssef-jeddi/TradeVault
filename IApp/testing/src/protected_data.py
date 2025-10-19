# dataprotector deserializer module
import os
import zipfile
from borsh_construct import String, I128, F64, Bool


def getValue(path: str, schema: str):
    file_path = path.replace('.', '/')
    IEXEC_IN = os.getenv('IEXEC_IN')
    IEXEC_DATASET_FILENAME = os.getenv('IEXEC_DATASET_FILENAME')

    if IEXEC_DATASET_FILENAME == None:
        raise Exception('Missing protected data')

    dataset_file_path = os.path.join(IEXEC_IN, IEXEC_DATASET_FILENAME)

    file_bytes: bytes
    try:
        # Open the ZIP archive
        with zipfile.ZipFile(dataset_file_path, 'r') as zipf:
            # Read the file from the ZIP archive as bytes
            with zipf.open(file_path) as file:
                file_bytes = file.read()
    except:
        raise Exception(f"Failed to load path {path}")

    try:
        if schema == 'bool':
            return Bool.parse(file_bytes)
        if schema == 'f64':
            return F64.parse(file_bytes)
        if schema == 'i128':
            return I128.parse(file_bytes)
        if schema == 'string':
            return String.parse(file_bytes)
    except:
        raise Exception(f"Failed to deserialize \"{path}\" as \"{schema}\"")

    return file_bytes
