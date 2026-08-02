import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { dataApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';

export default function DataTransfer() {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ recipes: number; cookbooks: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await dataApi.exportData(exportFormat);
      const blob = new Blob([res.data as BlobPart], {
        type: exportFormat === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supmeal-export.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé !');
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ L\'import va créer de nouvelles recettes et cookbooks dans votre compte. Continuer ?')) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await dataApi.importData(file);
      const result = res.data.data!;
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Import réussi : ${result.recipes} recettes, ${result.cookbooks} cookbooks`);
      } else {
        toast.success(`Import partiel : ${result.recipes} recettes, ${result.cookbooks} cookbooks (${result.errors.length} erreurs)`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Import / Export</h1>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle>📤 Exporter mes données</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Exportez l'ensemble de vos recettes personnelles et cookbooks dans un fichier portable.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Le fichier exporté contiendra <strong>toutes vos données en clair</strong>. Conservez-le en lieu sûr.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="json" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')}
                  className="text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-medium">JSON</span>
                <span className="text-xs text-gray-500">(Complet, compatible Mealie)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="csv" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')}
                  className="text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-medium">CSV</span>
                <span className="text-xs text-gray-500">(Tableur)</span>
              </label>
            </div>
          </div>

          <Button onClick={handleExport} loading={exporting} leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }>
            Exporter en {exportFormat.toUpperCase()}
          </Button>
        </div>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle>📥 Importer des données</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Importez des recettes depuis un fichier JSON (SUPMEAL ou compatible Mealie) ou CSV.
            Vous serez automatiquement assigné comme créateur.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 Formats acceptés : <strong>JSON</strong> (export SUPMEAL / Mealie) ou <strong>CSV</strong> (avec colonnes : cookbook, title, description, prepTime, cookTime, portions, sourceUrl, tags, ingredients, steps)
            </p>
          </div>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <div className="text-3xl mb-2">📂</div>
            <p className="font-medium text-gray-700">{importing ? 'Import en cours...' : 'Cliquez pour sélectionner un fichier'}</p>
            <p className="text-sm text-gray-400 mt-1">JSON ou CSV — max 10 Mo</p>
          </div>

          {/* Import result */}
          {importResult && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="text-green-700">✅ {importResult.recipes} recettes importées</span>
                <span className="text-green-700">✅ {importResult.cookbooks} cookbooks importés</span>
              </div>
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">⚠️ {importResult.errors.length} erreur(s) :</p>
                  <ul className="space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
