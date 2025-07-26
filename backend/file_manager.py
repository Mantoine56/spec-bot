"""
File system management for Spec-Bot generated documents.
Handles writing files to disk, versioning, and backup operations.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import json

from config import settings

logger = logging.getLogger(__name__)


class FileManager:
    """Manages file system operations for generated specification documents"""
    
    def __init__(self):
        """Initialize file manager with configured directories"""
        self.output_dir = Path(settings.output_dir)
        self.backup_dir = Path(settings.backup_dir)
        
        # Ensure directories exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"File manager initialized - Output: {self.output_dir}, Backup: {self.backup_dir}")
    
    def create_spec_directory(self, feature_name: str) -> Path:
        """
        Create directory structure for a feature spec.
        
        Args:
            feature_name: Name of the feature
            
        Returns:
            Path to the created feature directory
        """
        
        # Sanitize feature name for filesystem
        safe_name = self._sanitize_filename(feature_name)
        feature_dir = self.output_dir / safe_name
        
        # Create directory if it doesn't exist
        feature_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Created spec directory: {feature_dir}")
        return feature_dir
    
    def write_specification_files(
        self, 
        workflow_id: str,
        feature_name: str,
        files: Dict[str, str],
        create_backup: bool = True
    ) -> Dict[str, str]:
        """
        Write generated specification files to disk.
        
        Args:
            workflow_id: Unique workflow identifier
            feature_name: Name of the feature
            files: Dictionary of filename -> content
            create_backup: Whether to create backup of existing files
            
        Returns:
            Dictionary of filename -> written file path
        """
        
        try:
            # Create feature directory
            feature_dir = self.create_spec_directory(feature_name)
            
            written_files = {}
            
            for filename, content in files.items():
                file_path = feature_dir / filename
                
                # Create backup if file exists and backup is requested
                if create_backup and file_path.exists():
                    self._create_file_backup(file_path, workflow_id)
                
                # Write the new content
                self._write_file_atomic(file_path, content)
                written_files[filename] = str(file_path)
                
                logger.info(f"Wrote file: {file_path}")
            
            # Create metadata file
            metadata = {
                "workflow_id": workflow_id,
                "feature_name": feature_name,
                "generated_at": datetime.utcnow().isoformat(),
                "files": list(files.keys()),
                "file_paths": written_files
            }
            
            metadata_path = feature_dir / "metadata.json"
            self._write_file_atomic(metadata_path, json.dumps(metadata, indent=2))
            
            logger.info(f"Successfully wrote {len(files)} files for {feature_name}")
            return written_files
            
        except Exception as e:
            logger.error(f"Error writing specification files: {e}")
            raise
    
    def read_specification_files(self, feature_name: str) -> Optional[Dict[str, str]]:
        """
        Read existing specification files from disk.
        
        Args:
            feature_name: Name of the feature
            
        Returns:
            Dictionary of filename -> content, or None if not found
        """
        
        try:
            safe_name = self._sanitize_filename(feature_name)
            feature_dir = self.output_dir / safe_name
            
            if not feature_dir.exists():
                return None
            
            files = {}
            
            # Look for standard spec files
            for filename in ["requirements.md", "design.md", "tasks.md"]:
                file_path = feature_dir / filename
                if file_path.exists():
                    files[filename] = file_path.read_text(encoding='utf-8')
            
            return files if files else None
            
        except Exception as e:
            logger.error(f"Error reading specification files for {feature_name}: {e}")
            return None
    
    def list_feature_directories(self) -> List[Dict[str, any]]:
        """
        List all feature directories with metadata.
        
        Returns:
            List of feature directory information
        """
        
        try:
            features = []
            
            for item in self.output_dir.iterdir():
                if item.is_dir():
                    metadata_path = item / "metadata.json"
                    
                    if metadata_path.exists():
                        try:
                            metadata = json.loads(metadata_path.read_text())
                            features.append({
                                "feature_name": metadata.get("feature_name", item.name),
                                "directory": str(item),
                                "generated_at": metadata.get("generated_at"),
                                "workflow_id": metadata.get("workflow_id"),
                                "files": metadata.get("files", [])
                            })
                        except json.JSONDecodeError:
                            # Directory without valid metadata
                            features.append({
                                "feature_name": item.name,
                                "directory": str(item),
                                "generated_at": None,
                                "workflow_id": None,
                                "files": [f.name for f in item.iterdir() if f.is_file()]
                            })
            
            return sorted(features, key=lambda x: x.get("generated_at") or "", reverse=True)
            
        except Exception as e:
            logger.error(f"Error listing feature directories: {e}")
            return []
    
    def delete_feature_directory(self, feature_name: str, create_backup: bool = True) -> bool:
        """
        Delete a feature directory and its contents.
        
        Args:
            feature_name: Name of the feature to delete
            create_backup: Whether to create a backup before deletion
            
        Returns:
            True if successful, False otherwise
        """
        
        try:
            safe_name = self._sanitize_filename(feature_name)
            feature_dir = self.output_dir / safe_name
            
            if not feature_dir.exists():
                logger.warning(f"Feature directory not found: {feature_dir}")
                return False
            
            if create_backup:
                # Create backup of entire directory
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                backup_path = self.backup_dir / f"{safe_name}_deleted_{timestamp}"
                shutil.copytree(feature_dir, backup_path)
                logger.info(f"Created backup before deletion: {backup_path}")
            
            # Delete the directory
            shutil.rmtree(feature_dir)
            logger.info(f"Deleted feature directory: {feature_dir}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting feature directory {feature_name}: {e}")
            return False
    
    def get_file_versions(self, feature_name: str, filename: str) -> List[Dict[str, any]]:
        """
        Get version history for a specific file.
        
        Args:
            feature_name: Name of the feature
            filename: Name of the file
            
        Returns:
            List of file versions with metadata
        """
        
        try:
            safe_name = self._sanitize_filename(feature_name)
            safe_filename = self._sanitize_filename(filename)
            
            versions = []
            
            # Look for backup files in backup directory
            backup_pattern = f"{safe_name}_{safe_filename}_*"
            
            for backup_file in self.backup_dir.glob(backup_pattern):
                if backup_file.is_file():
                    stat = backup_file.stat()
                    versions.append({
                        "path": str(backup_file),
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "size": stat.st_size,
                        "is_backup": True
                    })
            
            # Add current version
            current_path = self.output_dir / safe_name / filename
            if current_path.exists():
                stat = current_path.stat()
                versions.append({
                    "path": str(current_path),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size": stat.st_size,
                    "is_backup": False
                })
            
            return sorted(versions, key=lambda x: x["created_at"], reverse=True)
            
        except Exception as e:
            logger.error(f"Error getting file versions for {feature_name}/{filename}: {e}")
            return []
    
    def _sanitize_filename(self, name: str) -> str:
        """
        Sanitize a name for use as a filename/directory name.
        
        Args:
            name: Original name
            
        Returns:
            Sanitized name safe for filesystem
        """
        
        # Replace spaces and special characters
        safe_name = name.replace(" ", "_").replace("-", "_")
        
        # Remove or replace problematic characters
        safe_chars = []
        for char in safe_name:
            if char.isalnum() or char in "_-.":
                safe_chars.append(char)
            else:
                safe_chars.append("_")
        
        result = "".join(safe_chars).strip("_").lower()
        
        # Ensure it's not empty and not too long
        if not result:
            result = "unnamed"
        
        if len(result) > 50:
            result = result[:50].rstrip("_")
        
        return result
    
    def _create_file_backup(self, file_path: Path, workflow_id: str) -> Path:
        """
        Create a backup of an existing file.
        
        Args:
            file_path: Path to the file to backup
            workflow_id: Current workflow ID for context
            
        Returns:
            Path to the backup file
        """
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{file_path.stem}_{timestamp}_{workflow_id[:8]}{file_path.suffix}"
        backup_path = self.backup_dir / backup_name
        
        shutil.copy2(file_path, backup_path)
        logger.info(f"Created backup: {backup_path}")
        
        return backup_path
    
    def _write_file_atomic(self, file_path: Path, content: str) -> None:
        """
        Write file content atomically to prevent corruption.
        
        Args:
            file_path: Target file path
            content: Content to write
        """
        
        # Write to temporary file first
        temp_path = file_path.with_suffix(f"{file_path.suffix}.tmp")
        
        try:
            temp_path.write_text(content, encoding='utf-8')
            # Atomic move to final location
            temp_path.replace(file_path)
        except Exception:
            # Clean up temp file if something went wrong
            if temp_path.exists():
                temp_path.unlink()
            raise
    
    def cleanup_old_backups(self, days_to_keep: int = 30) -> int:
        """
        Clean up old backup files.
        
        Args:
            days_to_keep: Number of days of backups to retain
            
        Returns:
            Number of files cleaned up
        """
        
        try:
            cutoff_time = datetime.utcnow().timestamp() - (days_to_keep * 24 * 60 * 60)
            cleaned_count = 0
            
            for backup_file in self.backup_dir.iterdir():
                if backup_file.is_file():
                    if backup_file.stat().st_ctime < cutoff_time:
                        backup_file.unlink()
                        cleaned_count += 1
                        logger.debug(f"Cleaned up old backup: {backup_file}")
            
            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} old backup files")
            
            return cleaned_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old backups: {e}")
            return 0


# Global file manager instance
_file_manager = None


def get_file_manager() -> FileManager:
    """Get the global file manager instance"""
    global _file_manager
    if _file_manager is None:
        _file_manager = FileManager()
    return _file_manager 