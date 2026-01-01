
export type FileType = 'image' | 'text' | 'pdf' | 'other';

export interface DriveFile {
  id: string;
  name: string;
  type: FileType;
  mimeType: string;
  size: number;
  uploadDate: number;
  data: Blob; // Changed from string to Blob for IndexedDB efficiency
  previewUrl?: string; // Transient URL created via URL.createObjectURL
  notes: string;
  smartAnalysis?: string;
  isFavorite: boolean;
}

export interface FilterState {
  search: string;
  type: FileType | 'all' | 'documents';
  sortBy: 'date' | 'name' | 'size';
  onlyStarred: boolean;
}
