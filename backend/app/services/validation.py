import pandas as pd
import io
from fastapi import HTTPException

def parse_and_validate_file(content: bytes, filename: str) -> pd.DataFrame:
    """Parses an uploaded CSV or Excel file and returns a validated DataFrame."""
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xls', '.xlsx')):
            # Handle cases where merged headers or weird formatting might cause issues
            df = pd.read_excel(io.BytesIO(content))
            # Clean columns that might be 'Unnamed: X' from merged cells
            df.columns = [str(c).strip() if not str(c).startswith('Unnamed:') else '' for c in df.columns]
        else:
            raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")
        
        # Drop completely empty rows
        df = df.dropna(how='all')
        
        # Clean column names (strip whitespace)
        df.rename(columns=lambda x: str(x).strip(), inplace=True)
        return df
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
