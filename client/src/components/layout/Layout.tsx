import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
          <Box
            sx={{
              maxWidth: 1280,
              mx: 'auto',
              px: { xs: 2, sm: 3, lg: 4 },
              py: 3,
              /* bottom padding for mobile bottom nav */
              pb: { xs: '80px', lg: 3 },
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
      <BottomNav />
    </Box>
  );
}
