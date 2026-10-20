export function buildExportMetadata({ providerValue, selectedLanguage, selectedContentType }) {
  return {
    provider: providerValue,
    language: selectedLanguage,
    contentType: selectedContentType !== 'auto' ? selectedContentType : 'auto',
  };
}
