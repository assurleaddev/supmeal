import { Link } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import { useAuthStore } from '../store/authStore';

/**
 * Page 404.
 *
 * Les URL inconnues étaient silencieusement redirigées vers l'accueil : l'utilisateur perdait le
 * contexte sans comprendre pourquoi, et un lien mort passait pour une page valide.
 */
export default function NotFound() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography
            aria-hidden="true"
            sx={{ fontSize: { xs: '4.5rem', sm: '6rem' }, fontWeight: 800, lineHeight: 1, color: 'primary.main' }}
          >
            404
          </Typography>

          <Box>
            <Typography component="h1" variant="h5" fontWeight={700} mb={1}>
              Cette page n'existe pas
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Le lien est peut-être erroné, ou la recette a été supprimée depuis.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              component={Link}
              to={isAuthenticated ? '/home' : '/'}
              variant="contained"
              startIcon={<HomeIcon />}
            >
              {isAuthenticated ? 'Retour au tableau de bord' : "Retour à l'accueil"}
            </Button>

            {isAuthenticated && (
              <Button component={Link} to="/recipes" variant="outlined" startIcon={<SearchIcon />} color="inherit">
                Parcourir mes recettes
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
