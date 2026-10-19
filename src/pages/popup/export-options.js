export function buildExportMetadata({ providerValue, selectedLanguage, selectedContentType }) {
  return {
    provider: providerValue,
    language: selectedLanguage,
    contentType: selectedContentType !== 'auto' ? selectedContentType : 'auto',
  };
}

export function mergeEmailOptions(checked, availability) {
  return {
    includeSummary: !!checked.includeSummary,
    includeKeypoints: !!checked.includeKeypoints,
    includeTranslation: !!(checked.includeTranslation && availability.translation),
    includeQA: !!(checked.includeQA && availability.qa),
    includeCitations: !!(checked.includeCitations && availability.citations),
  };
}

export function hasAnySelected(options) {
  return (
    options.includeSummary ||
    options.includeKeypoints ||
    options.includeTranslation ||
    options.includeQA ||
    options.includeCitations
  );
}
