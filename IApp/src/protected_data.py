# dataprotector deserializer module
import os
import zipfile
from borsh_construct import String, I128, F64, Bool


def getValue(path: str, schema: str, bulkIndex: int = None) -> any:
    file_path = path.replace('.', '/')
    IEXEC_IN = os.getenv('IEXEC_IN')
    file_name: str

    if bulkIndex != None:
        file_name = os.getenv(
            f'IEXEC_DATASET_{bulkIndex}_FILENAME')
    else:
        file_name = os.getenv('IEXEC_DATASET_FILENAME')

    if file_name == None:
        raise Exception('Missing protected data')

    dataset_file_path = os.path.join(IEXEC_IN, file_name)

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
