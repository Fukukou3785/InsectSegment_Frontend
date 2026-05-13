export type BodyPartType = "head" | "thorax" | "abdomen" | "legs"

export interface MaskData {
  head: ImageData | null
  thorax: ImageData | null
  abdomen: ImageData | null
  legs: ImageData | null
}

export interface SegmentationResult {
  success: boolean
  masks: MaskData
  metadata?: {
    timestamp: string
    modelVersion: string
    confidence: Record<BodyPartType, number>
  }
}

export interface SavedMask {
  id: string
  imageId: string
  originalMask: string // Base64 encoded
  editedMask: string // Base64 encoded
  timestamp: string
  bodyParts: Record<
    BodyPartType,
    {
      edited: boolean
      confidence: number
    }
  >
}

// MAPHIS project structure types based on the provided information
export interface MaphisProject {
  images: string[] // Original images
  thumbnails: string[] // Thumbnail images
  labels: MaphisLabel[] // 32-bit integer label images (*.tif)
  projectInfo: ProjectInfo
  photoInfo: PhotoInfo[]
  labelsDefinition: LabelsDefinition
}

export interface ProjectInfo {
  projectType: string
  labelSet: string
  createdAt: string
}

export interface PhotoInfo {
  filename: string
  importedAt: string
  scale?: {
    value: number
    unit: string
  }
  tags: string[]
  labelSets: {
    [key: string]: {
      segmented: boolean
      approved: boolean
    }
  }
}

export interface MaphisLabel {
  filename: string
  measurements: Record<string, any> // Currently empty object
}

export interface LabelsDefinition {
  labels: {
    [key: string]: {
      value: number // Bit assignment
      color: string // Hex color for visualization
      level: number // Hierarchy level
      parent?: string
    }
  }
  hierarchy: LabelHierarchy
}

export interface LabelHierarchy {
  name: string
  children?: LabelHierarchy[]
}
