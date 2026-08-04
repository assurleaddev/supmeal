import { useRef } from 'react'; // used by Reveal, ParallaxBlob, SectionHeading
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import HeroSection from '@/components/ui/glassmorphism-trust-hero';
import {
  Box, Button, Typography, Container, Grid, Paper, Stack, Chip, Avatar, Divider,
} from '@mui/material';
import {
  motion, useScroll, useTransform, useInView,
  AnimatePresence,
} from 'framer-motion';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import DevicesIcon from '@mui/icons-material/Devices';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import StarIcon from '@mui/icons-material/Star';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

/* ─── Motion components ─── */
const MotionBox = motion(Box as any);
const MotionPaper = motion(Paper as any);
const MotionTypography = motion(Typography as any);

/* ─── Reusable scroll-reveal wrapper ─── */
function Reveal({
  children,
  delay = 0,
  direction = 'up',
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'scale';
  once?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-60px 0px' });

  const variants = {
    up: {
      hidden: { opacity: 0, y: 40 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } },
    },
    left: {
      hidden: { opacity: 0, x: -40 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } },
    },
    right: {
      hidden: { opacity: 0, x: 40 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.88 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] } },
    },
  };

  return (
    <Box ref={ref}>
      <AnimatePresence>
        <MotionBox
          variants={variants[direction]}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {children}
        </MotionBox>
      </AnimatePresence>
    </Box>
  );
}

/* ─── Stagger container ─── */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Data ─── */
const FEATURES = [
  { icon: RestaurantMenuIcon, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', title: 'Organisez vos recettes', desc: 'Centralisez toutes vos recettes avec photos, ingrédients, étapes et tags. Retrouvez-les en quelques secondes.' },
  { icon: CalendarMonthIcon, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', title: 'Planifiez vos repas', desc: 'Construisez votre menu de la semaine en glissant vos recettes sur le planning. Fini les "qu\'est-ce qu\'on mange ?".' },
  { icon: CollectionsBookmarkIcon, color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', title: 'Cookbooks partagés', desc: 'Créez des carnets de recettes et invitez votre famille ou vos amis pour cuisiner ensemble.' },
  { icon: SearchIcon, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', title: 'Recherche avancée', desc: 'Filtrez par ingrédients, temps de cuisson, tags ou cookbook. Trouvez exactement ce qu\'il vous faut.' },
  { icon: CloudUploadIcon, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', title: 'Import & Export', desc: 'Importez vos recettes depuis un fichier ou exportez tout votre cookbook. Vos données vous appartiennent.' },
  { icon: DevicesIcon, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', title: 'Disponible partout', desc: 'Accédez à vos recettes depuis votre téléphone, tablette ou ordinateur. Toujours synchronisé.' },
];

const STEPS = [
  { num: '01', icon: AutoAwesomeIcon, color: '#16a34a', bg: '#f0fdf4', title: 'Créez votre compte', desc: 'Inscription gratuite en 30 secondes. Aucune carte bancaire requise.' },
  { num: '02', icon: RestaurantMenuIcon, color: '#ea580c', bg: '#fff7ed', title: 'Ajoutez vos recettes', desc: 'Importez ou créez vos recettes avec photos, ingrédients et étapes détaillées.' },
  { num: '03', icon: CalendarMonthIcon, color: '#8b5cf6', bg: '#f5f3ff', title: 'Planifiez & cuisinez', desc: 'Organisez votre semaine en quelques clics et générez votre liste de courses.' },
];

const TESTIMONIALS = [
  { quote: 'Enfin une app qui centralise tout ! Mes recettes de famille étaient éparpillées partout, maintenant elles sont toutes là.', name: 'Sophie M.', role: 'Maman de 3 enfants', initials: 'SM', avatarColor: '#16a34a', stars: 5 },
  { quote: 'Le planning de repas change vraiment la vie. Plus de stress le soir pour trouver quoi cuisiner. Je recommande !', name: 'Thomas L.', role: 'Passionné de cuisine', initials: 'TL', avatarColor: '#0ea5e9', stars: 5 },
  { quote: "Les cookbooks partagés avec ma famille, c'est parfait ! On partage nos recettes préférées facilement.", name: 'Amira K.', role: 'Étudiante en cuisine', initials: 'AK', avatarColor: '#8b5cf6', stars: 5 },
];

const FAQS = [
  { q: 'SUPMEAL est-il vraiment gratuit ?', a: 'Oui, totalement gratuit. Aucune carte bancaire requise, aucune limite sur le nombre de recettes ou de cookbooks.' },
  { q: 'Mes recettes sont-elles privées ?', a: 'Absolument. Vos recettes sont privées par défaut. Vous choisissez ce que vous partagez, avec qui et quand.' },
  { q: 'Puis-je importer mes recettes existantes ?', a: "Oui, SUPMEAL supporte l'import de fichiers recettes. Vous pouvez également exporter vos données à tout moment." },
  { q: 'Comment fonctionne le planning de repas ?', a: "Glissez vos recettes sur le calendrier hebdomadaire. L'app génère automatiquement votre liste de courses." },
];

/* ─── Floating particles for hero ─── */
const PARTICLES = [
  { size: 6, x: '10%', y: '20%', color: '#bbf7d0', delay: 0, duration: 4 },
  { size: 10, x: '85%', y: '15%', color: '#bae6fd', delay: 0.5, duration: 5 },
  { size: 7, x: '75%', y: '70%', color: '#fed7aa', delay: 1, duration: 4.5 },
  { size: 5, x: '20%', y: '75%', color: '#ddd6fe', delay: 1.5, duration: 3.8 },
  { size: 8, x: '55%', y: '88%', color: '#a5f3fc', delay: 0.8, duration: 5.2 },
  { size: 4, x: '40%', y: '10%', color: '#fde68a', delay: 0.3, duration: 4.2 },
  { size: 9, x: '92%', y: '50%', color: '#bbf7d0', delay: 1.2, duration: 4.8 },
  { size: 6, x: '5%', y: '50%', color: '#fce7f3', delay: 0.6, duration: 3.5 },
];

/* ─── App Mockup ─── */
function AppMockup() {
  const cards = [
    { title: 'Pasta Carbonara', time: '25 min', portions: 4, color: '#fef9c3' },
    { title: 'Salade César', time: '15 min', portions: 2, color: '#dcfce7' },
    { title: 'Tarte pommes', time: '50 min', portions: 6, color: '#fce7f3' },
  ];

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Glow */}
      <Box sx={{ position: 'absolute', inset: '-30px', background: 'radial-gradient(ellipse at center, rgba(22,163,74,0.14) 0%, transparent 68%)', borderRadius: 4, pointerEvents: 'none', zIndex: 0 }} />

      <MotionBox
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Box sx={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.9)', bgcolor: 'white', maxWidth: 480, mx: 'auto' }}>
          {/* Browser chrome */}
          <Box sx={{ bgcolor: '#f1f5f9', px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', gap: 0.6 }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
              ))}
            </Box>
            <Box sx={{ flex: 1, bgcolor: 'white', borderRadius: 1, height: 22, mx: 1, display: 'flex', alignItems: 'center', px: 1.5, border: '1px solid #e2e8f0' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', mr: 0.8 }} />
              <Typography sx={{ fontSize: 10, color: '#64748b' }}>supmeal.app</Typography>
            </Box>
          </Box>

          {/* Mini navbar */}
          <Box sx={{ bgcolor: 'white', px: 2, py: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0', gap: 1 }}>
            <Box sx={{ width: 22, height: 22, bgcolor: '#16a34a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(22,163,74,0.35)' }}>
              <Typography sx={{ color: 'white', fontSize: 11, fontWeight: 700 }}>S</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e293b', mr: 'auto', letterSpacing: '-0.01em' }}>SUPMEAL</Typography>
            <Box sx={{ height: 22, px: 1.5, bgcolor: '#16a34a', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'white', fontWeight: 600 }}>+ Recette</Typography>
            </Box>
            <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#16a34a' }}>SL</Typography>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ display: 'flex', height: 260 }}>
            <Box sx={{ width: 84, bgcolor: '#fafafa', borderRight: '1px solid #f1f5f9', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
              {[
                { label: 'Accueil', active: false },
                { label: 'Recettes', active: true },
                { label: 'Planning', active: false },
                { label: 'Favoris', active: false },
              ].map((item) => (
                <Box key={item.label} sx={{ px: 1, py: 0.75, borderRadius: 1.5, bgcolor: item.active ? '#f0fdf4' : 'transparent', display: 'flex', alignItems: 'center', gap: 0.75, border: item.active ? '1px solid #bbf7d0' : '1px solid transparent' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: item.active ? '#16a34a' : '#e2e8f0', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 9, color: item.active ? '#16a34a' : '#94a3b8', fontWeight: item.active ? 700 : 400 }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ flex: 1, p: 1.5, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}>Mes recettes</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {['Tout', 'Rapide', 'Dîner'].map((tag, i) => (
                    <Box key={tag} sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: i === 0 ? '#16a34a' : '#f1f5f9', border: i === 0 ? 'none' : '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 7, color: i === 0 ? 'white' : '#64748b', fontWeight: i === 0 ? 600 : 400 }}>{tag}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.75 }}>
                {cards.map((card) => (
                  <Box key={card.title} sx={{ borderRadius: 1.5, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <Box sx={{ height: 44, bgcolor: card.color, position: 'relative' }}>
                      <Box sx={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: 8 }}>♥</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ p: 0.75 }}>
                      <Typography sx={{ fontSize: 8, fontWeight: 600, color: '#1e293b', lineHeight: 1.2, mb: 0.5 }}>{card.title}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
                        <AccessTimeIcon sx={{ fontSize: 8, color: '#16a34a' }} />
                        <Typography sx={{ fontSize: 7, color: '#64748b' }}>{card.time}</Typography>
                        <PeopleOutlineIcon sx={{ fontSize: 8, color: '#94a3b8' }} />
                        <Typography sx={{ fontSize: 7, color: '#64748b' }}>{card.portions}</Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}>Planning</Typography>
                  <Typography sx={{ fontSize: 8, color: '#16a34a', fontWeight: 600 }}>Cette semaine</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[
                    { d: 'Lun', filled: true, active: false },
                    { d: 'Mar', filled: true, active: false },
                    { d: 'Mer', filled: true, active: true },
                    { d: 'Jeu', filled: false, active: false },
                    { d: 'Ven', filled: false, active: false },
                  ].map(({ d, filled, active }) => (
                    <Box key={d} sx={{ flex: 1, textAlign: 'center', bgcolor: active ? '#f0fdf4' : '#f8fafc', borderRadius: 1, py: 0.5, border: '1px solid', borderColor: active ? '#bbf7d0' : '#e2e8f0' }}>
                      <Typography sx={{ fontSize: 7, color: active ? '#16a34a' : '#94a3b8', fontWeight: active ? 700 : 400 }}>{d}</Typography>
                      {filled && <Box sx={{ width: '70%', height: 3, bgcolor: active ? '#16a34a' : '#cbd5e1', borderRadius: 0.5, mx: 'auto', mt: 0.4 }} />}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </MotionBox>

      {/* Floating badge — recipes */}
      <MotionBox
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        sx={{ position: 'absolute', bottom: 20, left: { xs: -8, md: -28 }, bgcolor: 'white', borderRadius: 3, px: 1.5, py: 1, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', zIndex: 2, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Box sx={{ width: 28, height: 28, bgcolor: '#f0fdf4', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RestaurantMenuIcon sx={{ fontSize: 16, color: '#16a34a' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>48 recettes</Typography>
          <Typography sx={{ fontSize: 9, color: '#64748b' }}>sauvegardées</Typography>
        </Box>
      </MotionBox>

      {/* Floating badge — week */}
      <MotionBox
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        sx={{ position: 'absolute', top: 20, right: { xs: -8, md: -28 }, bgcolor: 'white', borderRadius: 3, px: 1.5, py: 1, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', zIndex: 2, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Box sx={{ width: 28, height: 28, bgcolor: '#fff7ed', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarMonthIcon sx={{ fontSize: 16, color: '#ea580c' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>Semaine planifiée</Typography>
          <Typography sx={{ fontSize: 9, color: '#64748b' }}>5 repas prévus</Typography>
        </Box>
      </MotionBox>
    </Box>
  );
}

function StarRating({ count }: { count: number }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      {Array.from({ length: count }).map((_, i) => (
        <StarIcon key={i} sx={{ fontSize: 14, color: '#f59e0b' }} />
      ))}
    </Box>
  );
}

/* ─── Animated section heading ─── */
function SectionHeading({ chip, chipColor, chipBg, title, subtitle }: {
  chip: string; chipColor: string; chipBg: string;
  title: React.ReactNode; subtitle?: string;
}) {
  return (
    <Reveal>
      <Box sx={{ textAlign: 'center', mb: { xs: 7, md: 9 } }}>
        <Chip label={chip} size="small" sx={{ bgcolor: chipBg, color: chipColor, fontWeight: 600, mb: 2, borderRadius: '8px' }} />
        <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a', mb: subtitle ? 2 : 0 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" sx={{ color: '#475569', maxWidth: 500, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.7 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Reveal>
  );
}

/* ─── Parallax scroll background blob ─── */
function ParallaxBlob({ top, left, right, bottom, color, size }: {
  top?: number | string; left?: number | string; right?: number | string; bottom?: number | string;
  color: string; size: number;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <MotionBox
      ref={ref}
      style={{ y }}
      sx={{
        position: 'absolute',
        top, left, right, bottom,
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

export default function LandingPage() {

  return (
    <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAVBAR ── */}
      <MotionBox
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        component="nav"
        sx={{
          position: 'sticky', top: 0, zIndex: 100,
          bgcolor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, gap: 2 }}>
            <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', mr: 'auto' }}>
              <MotionBox
                whileHover={{ rotate: [0, -8, 8, 0], scale: 1.05 }}
                transition={{ duration: 0.4 }}
                sx={{ width: 36, height: 36, bgcolor: '#16a34a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(22,163,74,0.30)' }}
              >
                <Typography color="white" fontWeight={800} fontSize={18}>S</Typography>
              </MotionBox>
              <Typography fontWeight={800} fontSize={18} color="#0f172a" letterSpacing="-0.02em">SUPMEAL</Typography>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
              {[
                { label: 'Fonctionnalités', href: '#features' },
                { label: 'Comment ça marche', href: '#steps' },
                { label: 'FAQ', href: '#faq' },
              ].map((item) => (
                <Button key={item.label} component="a" href={item.href}
                  sx={{ color: '#475569', fontWeight: 500, fontSize: '0.875rem', px: 1.5, '&:hover': { color: '#0f172a', bgcolor: '#f8fafc' } }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            <Button component={Link} to="/login" variant="text"
              sx={{ color: '#475569', fontWeight: 500, fontSize: '0.875rem', display: { xs: 'none', sm: 'flex' } }}
            >
              Se connecter
            </Button>
            <MotionBox whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button component={Link} to="/register" variant="contained" size="small"
                sx={{ bgcolor: '#16a34a', color: 'white', fontWeight: 600, px: 2.5, py: 1, borderRadius: '10px', fontSize: '0.875rem', boxShadow: '0 2px 10px rgba(22,163,74,0.25)', '&:hover': { bgcolor: '#15803d' } }}
              >
                Commencer
              </Button>
            </MotionBox>
          </Box>
        </Container>
      </MotionBox>

      {/* ── HERO ── */}
      <HeroSection />

      {/* ── STATS BAR ── */}
      <Box sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <Container maxWidth="lg">
          <Reveal>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 3, md: 6 }, justifyContent: 'center', alignItems: 'center', py: 4 }}>
              {[
                { value: '100%', label: 'Gratuit', color: '#16a34a' },
                { value: '∞', label: 'Recettes', color: '#ea580c' },
                { value: '∞', label: 'Cookbooks', color: '#0ea5e9' },
                { value: '3', label: 'Appareils', color: '#8b5cf6' },
                { value: '< 30s', label: 'Inscription', color: '#f59e0b' },
              ].map((s, i) => (
                <MotionBox
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  sx={{ textAlign: 'center' }}
                >
                  <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>{s.label}</Typography>
                </MotionBox>
              ))}
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* ── FEATURES ── */}
      <Box id="features" component="section" sx={{ py: { xs: 10, md: 14 }, position: 'relative', overflow: 'hidden' }}>
        <ParallaxBlob top={-80} right={-80} color="radial-gradient(circle, rgba(22,163,74,0.06) 0%, transparent 65%)" size={500} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <SectionHeading
            chip="Fonctionnalités" chipColor="#0ea5e9" chipBg="#f0f9ff"
            title="Tout ce qu'il vous faut"
            subtitle="Une application pensée pour simplifier votre quotidien en cuisine, de la recette à l'assiette."
          />

          <MotionBox
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <Grid container spacing={3}>
              {FEATURES.map((feature) => (
                <Grid item xs={12} sm={6} lg={4} key={feature.title}>
                  <MotionBox variants={staggerItem}>
                    <MotionPaper
                      elevation={0}
                      whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.10)', borderColor: feature.border }}
                      transition={{ duration: 0.25 }}
                      sx={{ p: 3.5, height: '100%', border: '1px solid #e2e8f0', borderRadius: '16px', bgcolor: 'white', cursor: 'default' }}
                    >
                      <MotionBox
                        whileHover={{ scale: 1.08, rotate: 4 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: feature.bg, border: `1px solid ${feature.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}
                      >
                        <feature.icon sx={{ fontSize: 26, color: feature.color }} />
                      </MotionBox>
                      <Typography variant="h6" fontWeight={700} mb={1} color="#0f172a" fontSize="1rem">{feature.title}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.7 }}>{feature.desc}</Typography>
                    </MotionPaper>
                  </MotionBox>
                </Grid>
              ))}
            </Grid>
          </MotionBox>
        </Container>
      </Box>

      {/* ── HOW IT WORKS ── */}
      <Box
        id="steps"
        component="section"
        sx={{
          py: { xs: 10, md: 14 },
          background: 'linear-gradient(180deg, #f8fafc 0%, #f0fdf4 100%)',
          borderTop: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ParallaxBlob bottom={-60} left={-60} color="radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 65%)" size={400} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <SectionHeading
            chip="Comment ça marche" chipColor="#16a34a" chipBg="#dcfce7"
            title="Démarrez en 3 étapes"
          />

          <Grid container spacing={4} alignItems="stretch">
            {STEPS.map((step, i) => (
              <Grid item xs={12} md={4} key={step.num} sx={{ position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 40, right: '-18%', width: '36%', zIndex: 0 }}>
                    <Box sx={{ height: 2, background: 'linear-gradient(90deg, #bbf7d0, #e2e8f0)', borderRadius: 2 }} />
                  </Box>
                )}

                <Reveal delay={i * 0.15} direction="up">
                  <MotionPaper
                    elevation={0}
                    whileHover={{ y: -6, boxShadow: '0 16px 48px rgba(0,0,0,0.09)' }}
                    transition={{ duration: 0.25 }}
                    sx={{ p: 4, height: '100%', border: '1px solid #e2e8f0', borderRadius: '16px', bgcolor: 'white', position: 'relative', zIndex: 1 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
                      <MotionBox
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: step.bg, border: `1px solid ${step.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <step.icon sx={{ fontSize: 24, color: step.color }} />
                      </MotionBox>
                      <Typography sx={{ fontSize: '2.5rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
                        {step.num}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} mb={1.5} color="#0f172a">{step.title}</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.7 }}>{step.desc}</Typography>
                  </MotionPaper>
                </Reveal>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── TESTIMONIALS ── */}
      <Box component="section" sx={{ py: { xs: 10, md: 14 }, position: 'relative', overflow: 'hidden' }}>
        <ParallaxBlob top={-50} right={-50} color="radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%)" size={400} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <SectionHeading
            chip="Ils adorent SUPMEAL" chipColor="#d97706" chipBg="#fffbeb"
            title="Ce qu'ils en disent"
          />

          <MotionBox
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <Grid container spacing={3}>
              {TESTIMONIALS.map((t) => (
                <Grid item xs={12} md={4} key={t.name}>
                  <MotionBox variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}>
                    <MotionPaper
                      elevation={0}
                      whileHover={{ y: -6, boxShadow: '0 16px 48px rgba(0,0,0,0.09)' }}
                      transition={{ duration: 0.25 }}
                      sx={{ p: 3.5, height: '100%', border: '1px solid #e2e8f0', borderRadius: '16px', bgcolor: 'white' }}
                    >
                      <StarRating count={t.stars} />
                      <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.75, mt: 2, mb: 3, fontSize: '0.95rem', fontStyle: 'italic' }}>
                        "{t.quote}"
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 38, height: 38, bgcolor: t.avatarColor, fontSize: '0.8rem', fontWeight: 700 }}>
                          {t.initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700} color="#0f172a">{t.name}</Typography>
                          <Typography variant="caption" color="#94a3b8">{t.role}</Typography>
                        </Box>
                      </Box>
                    </MotionPaper>
                  </MotionBox>
                </Grid>
              ))}
            </Grid>
          </MotionBox>
        </Container>
      </Box>

      {/* ── FAQ ── */}
      <Box id="faq" component="section" sx={{ py: { xs: 10, md: 14 }, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <Container maxWidth="md">
          <SectionHeading
            chip="FAQ" chipColor="#7c3aed" chipBg="#f5f3ff"
            title="Questions fréquentes"
          />

          <Reveal>
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', bgcolor: 'white', px: { xs: 2.5, md: 4 } }}>
              {FAQS.map((faq, i) => (
                <MotionBox
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Box sx={{ py: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                      <Typography fontWeight={600} color="#0f172a" sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>{faq.q}</Typography>
                      <KeyboardArrowDownIcon sx={{ fontSize: 20, color: '#94a3b8', flexShrink: 0, mt: 0.2 }} />
                    </Box>
                    <Typography variant="body2" color="#64748b" lineHeight={1.7} mt={1}>{faq.a}</Typography>
                  </Box>
                  {i < FAQS.length - 1 && <Divider />}
                </MotionBox>
              ))}
            </Paper>
          </Reveal>
        </Container>
      </Box>

      {/* ── FINAL CTA ── */}
      <Box
        component="section"
        sx={{
          py: { xs: 12, md: 16 }, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a2f 50%, #15803d 100%)',
        }}
      >
        {/* Mesh dots */}
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
        <MotionBox
          animate={{ scale: [1, 1.2, 1], rotate: [0, 15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          sx={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,0.20) 0%, transparent 65%)', pointerEvents: 'none' }}
        />
        <MotionBox
          animate={{ scale: [1, 1.15, 1], rotate: [0, -10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          sx={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 65%)', pointerEvents: 'none' }}
        />

        <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal direction="scale">
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important', color: '#fbbf24 !important' }} />}
              label="Rejoignez SUPMEAL aujourd'hui"
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', fontWeight: 600, mb: 3, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <Typography variant="h2" sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: 'white', mb: 2.5, lineHeight: 1.15 }}>
              Prêt à mieux cuisiner ?
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.70)', fontSize: { xs: '1rem', md: '1.15rem' }, mb: 5.5, maxWidth: 420, mx: 'auto', lineHeight: 1.7 }}>
              Rejoignez SUPMEAL gratuitement et prenez enfin le contrôle de vos recettes et repas.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <MotionBox whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button
                  component={Link} to="/register" variant="contained" size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ bgcolor: 'white', color: '#15803d', fontWeight: 700, px: 5, py: 1.8, fontSize: '1rem', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', '&:hover': { bgcolor: '#f0fdf4' } }}
                >
                  Créer mon compte gratuit
                </Button>
              </MotionBox>
              <MotionBox whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}>
                <Button
                  component={Link} to="/login" variant="outlined" size="large"
                  sx={{ color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.35)', fontWeight: 600, px: 4, py: 1.8, fontSize: '1rem', borderRadius: '12px', '&:hover': { borderColor: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.08)' } }}
                >
                  J'ai déjà un compte
                </Button>
              </MotionBox>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 5, flexWrap: 'wrap' }}>
              {['Aucune carte bancaire', 'Données privées', 'Accès illimité'].map((t) => (
                <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 15, color: '#4ade80' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.60)', fontWeight: 500 }}>{t}</Typography>
                </Box>
              ))}
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* ── FOOTER ── */}
      <Box component="footer" sx={{ bgcolor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} mb={4}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 30, height: 30, bgcolor: '#16a34a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="white" fontWeight={800} fontSize={15}>S</Typography>
                </Box>
                <Typography fontWeight={800} fontSize={16} color="rgba(255,255,255,0.90)" letterSpacing="-0.01em">SUPMEAL</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 220 }}>
                Organisez vos recettes et planifiez vos repas facilement.
              </Typography>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', fontSize: '0.7rem', mb: 1.5, display: 'block' }}>Navigation</Typography>
              <Stack spacing={1}>
                {[{ label: 'Se connecter', to: '/login' }, { label: 'Créer un compte', to: '/register' }].map((link) => (
                  <Typography key={link.to} component={Link} to={link.to} variant="body2" sx={{ color: 'rgba(255,255,255,0.50)', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'rgba(255,255,255,0.85)' }, transition: 'color 0.15s' }}>
                    {link.label}
                  </Typography>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={6} sm={4}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', fontSize: '0.7rem', mb: 1.5, display: 'block' }}>Fonctionnalités</Typography>
              <Stack spacing={1}>
                {['Recettes', 'Planning', 'Cookbooks', 'Favoris'].map((f) => (
                  <Typography key={f} variant="body2" sx={{ color: 'rgba(255,255,255,0.50)', fontWeight: 500 }}>{f}</Typography>
                ))}
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.30)' }}>© {new Date().getFullYear()} SUPMEAL. Tous droits réservés.</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.20)' }}>Fait avec ♥ pour les passionnés de cuisine</Typography>
          </Box>
        </Container>
      </Box>

    </Box>
  );
}
