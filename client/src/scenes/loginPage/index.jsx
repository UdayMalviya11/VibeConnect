import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import Form from "./Form";

const LoginPage = () => {
  const theme = useTheme();
  const isNonMobileScreens = useMediaQuery("(min-width: 1000px)");
  return (
    <Box sx={{ minHeight: '100vh', background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.alt} 100%)` }}>
      <Box
        width="100%"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          backdropFilter: 'saturate(180%) blur(8px)',
          borderBottom: `1px solid ${theme.palette.neutral.light}`,
        }}
        p="1rem 6%"
        textAlign="center"
      >
        <Typography
          fontWeight={800}
          fontSize="clamp(1.4rem, 2.2rem, 2.6rem)"
          sx={{
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: 0.4,
          }}
        >
          VibeConnect
        </Typography>
      </Box>

      <Box
        width={isNonMobileScreens ? "560px" : "92%"}
        p="2rem"
        m="3rem auto"
        borderRadius="1rem"
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.neutral.light}`,
          boxShadow: theme.palette.mode === 'dark' ? 6 : 4,
        }}
      >
        <Typography fontWeight="700" variant="h4" sx={{ mb: "0.5rem", textAlign: 'center' }}>
          Welcome back
        </Typography>
        <Typography color={theme.palette.neutral.medium} sx={{ mb: "1.5rem", textAlign: 'center' }}>
          Sign in or create an account to continue
        </Typography>
        <Form />
      </Box>
    </Box>
  );
};

export default LoginPage;
