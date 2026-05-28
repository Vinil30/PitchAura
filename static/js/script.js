// Smooth scroll for "Get Started" CTA
document.querySelectorAll('.cta').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('overview').scrollIntoView({ behavior: 'smooth' });
  });
});

// Redirect Login & Trial buttons
document.querySelectorAll('.login-btn, .trial').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    // If it's a login button → go to /login
    if (el.classList.contains("login-btn")) {
      window.location.href = "/login";
    }
    // If it's a trial button → go to /signup
    if (el.classList.contains("trial")) {
      window.location.href = "/signup";
    }
  });
});
