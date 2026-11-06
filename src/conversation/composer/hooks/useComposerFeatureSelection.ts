import { useCallback } from 'react'

interface FeatureLike {
  id: string
}

interface UseComposerFeatureSelectionArgs {
  availableFeatures: readonly FeatureLike[]
  selectedFeatureIds: readonly string[]
  onSelectedFeatureIdsChange?: (featureIds: string[]) => void
}

interface UseComposerFeatureSelectionResult {
  updateSelectedFeature: (featureId: string, enabled: boolean) => void
}

export function useComposerFeatureSelection({
  availableFeatures,
  selectedFeatureIds,
  onSelectedFeatureIdsChange,
}: UseComposerFeatureSelectionArgs): UseComposerFeatureSelectionResult {
  const updateSelectedFeature = useCallback(
    (featureId: string, enabled: boolean): void => {
      if (!onSelectedFeatureIdsChange) return

      const nextFeatureIds = new Set(selectedFeatureIds)

      if (enabled) {
        nextFeatureIds.add(featureId)
      } else {
        nextFeatureIds.delete(featureId)
      }

      const orderedSelectedFeatureIds: string[] = []
      for (const feature of availableFeatures) {
        if (nextFeatureIds.has(feature.id)) {
          orderedSelectedFeatureIds.push(feature.id)
        }
      }

      onSelectedFeatureIdsChange(orderedSelectedFeatureIds)
    },
    [availableFeatures, onSelectedFeatureIdsChange, selectedFeatureIds],
  )

  return { updateSelectedFeature }
}
