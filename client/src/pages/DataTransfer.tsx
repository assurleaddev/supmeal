import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Button, RadioGroup, FormControlLabel, Radio, Alert, Checkbox,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { dataApi } from '../api';
import { ExportFormat } from '../types';

export default function DataTransfer() {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ recipes: number; cookbooks: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    // Le §2.2.6 impose que l'export n'ait lieu que « malgré un avertissement » : un bandeau passif
    // ne suffit pas, l'utilisateur doit reconnaître explicitement le risque.
    if (!warningAccepted) {
      toast.error("Cochez d'abord la case d'avertissement pour confirmer l'export");
      return;
    }
    setExporting(true);
    try {
      const res = await dataApi.exportData(exportFormat);
      const blob = new Blob([res.data as BlobPart], {
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFormat === 'csv' ? 'supmeal-export.csv' : `supmeal-export-${exportFormat}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé !');
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("⚠️ L'import va créer de nouvelles recettes et cookbooks dans votre compte. Continuer ?")) {
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
      toast.error(err.response?.data?.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" fontWeight={700}>Import / Export</Typography>

      {/* Export */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Typography variant="h6" fontWeight={600}>📤 Exporter mes données</Typography>
        <Typography variant="body2" color="text.secondary">
          Exportez l'ensemble de vos recettes personnelles et cookbooks dans un fichier portable.
        </Typography>

        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="body2" mb={1}>
            Le fichier exporté contiendra <strong>toutes vos données en clair</strong>, lisibles par
            quiconque y aura accès : titres, ingrédients, étapes et noms de vos cookbooks. Aucun
            chiffrement n'est appliqué. Conservez-le en lieu sûr et ne le partagez pas.
          </Typography>
          <FormControlLabel
            control={<Checkbox size="small" checked={warningAccepted} onChange={(e) => setWarningAccepted(e.target.checked)} />}
            label={<Typography variant="body2" fontWeight={600}>J'ai compris et je souhaite exporter mes données</Typography>}
          />
        </Alert>

        <Box>
          <Typography variant="body2" fontWeight={600} mb={1}>Format d'export</Typography>
          <RadioGroup value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} row>
            <FormControlLabel
              value="json"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>JSON</Typography>
                  <Typography variant="caption" color="text.secondary">Complet — recettes, cookbooks, réimportable</Typography>
                </Box>
              }
              sx={{ mr: 4 }}
            />
            <FormControlLabel
              value="csv"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>CSV</Typography>
                  <Typography variant="caption" color="text.secondary">Tableur Excel/Sheets</Typography>
                </Box>
              }
              sx={{ mr: 4 }}
            />
            <FormControlLabel
              value="mealie"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Mealie</Typography>
                  <Typography variant="caption" color="text.secondary">Importable dans Mealie</Typography>
                </Box>
              }
            />
          </RadioGroup>
        </Box>

        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exporting || !warningAccepted}
          sx={{ alignSelf: 'flex-start' }}
        >
          {exporting ? 'Export en cours...' : `Exporter en ${exportFormat.toUpperCase()}`}
        </Button>
      </Paper>

      {/* Import */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Typography variant="h6" fontWeight={600}>📥 Importer des données</Typography>
        <Typography variant="body2" color="text.secondary">
          Importez des recettes depuis un fichier JSON (SUPMEAL ou compatible Mealie) ou CSV.
          Vous serez automatiquement assigné comme créateur.
        </Typography>

        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Formats acceptés : <strong>JSON</strong> (export SUPMEAL / Mealie) ou <strong>CSV</strong> (avec colonnes :
          cookbook, title, description, prepTime, cookTime, portions, sourceUrl, tags, ingredients, steps)
        </Alert>

        <input ref={fileInputRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleImport} />

        <Box
          onClick={() => !importing && fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            cursor: importing ? 'default' : 'pointer',
            transition: 'all 0.2s',
            '&:hover': importing ? {} : { borderColor: 'primary.main', bgcolor: 'primary.50' },
          }}
        >
          <UploadFileIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" fontWeight={600} color={importing ? 'text.disabled' : 'text.primary'}>
            {importing ? 'Import en cours...' : 'Cliquez pour sélectionner un fichier'}
          </Typography>
          <Typography variant="caption" color="text.disabled">JSON ou CSV — max 10 Mo</Typography>
        </Box>

        {importResult && (
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2" color="success.dark">{importResult.recipes} recettes importées</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2" color="success.dark">{importResult.cookbooks} cookbooks importés</Typography>
              </Box>
            </Box>
            {importResult.errors.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight={600} color="error.main" mb={0.5}>
                  {importResult.errors.length} erreur(s) :
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {importResult.errors.map((e, i) => (
                    <Typography key={i} variant="caption" sx={{ bgcolor: 'error.50', color: 'error.dark', px: 1.5, py: 0.5, borderRadius: 1 }}>
                      {e}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Paper>
    </Box>
  );
}
