class AuthManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkVerificationStatus();
    this.checkResetToken();
  }

  setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
      resetPasswordForm.addEventListener('submit', (e) => this.handleResetPassword(e));
    }

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('error-message');
    
    if (errorElement) errorElement.classList.add('hidden');

    try {
      const response = await app.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success) {
        app.currentUser = response.data.user;
        app.connectSocket();
        window.location.href = '/';
      }
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
      }
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const errorElement = document.getElementById('error-message');
    const successElement = document.getElementById('success-message');
    
    if (errorElement) errorElement.classList.add('hidden');
    if (successElement) successElement.classList.add('hidden');

    if (password !== passwordConfirm) {
      if (errorElement) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.classList.remove('hidden');
      }
      return;
    }

    try {
      const response = await app.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password,
          passwordConfirm 
        })
      });

      if (response.success) {
        if (successElement) {
          successElement.textContent = response.message;
          successElement.classList.remove('hidden');
        }
        
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 3000);
      }
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
      }
    }
  }

  async handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const successElement = document.getElementById('success-message');
    const errorElement = document.getElementById('error-message');
    
    if (successElement) successElement.classList.add('hidden');
    if (errorElement) errorElement.classList.add('hidden');

    try {
      const response = await app.apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      if (successElement) {
        successElement.textContent = response.message;
        successElement.classList.remove('hidden');
      }
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
      }
    }
  }

  async handleResetPassword(e) {
    e.preventDefault();
    
    const token = new URLSearchParams(window.location.search).get('token');
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const errorElement = document.getElementById('error-message');
    const successElement = document.getElementById('success-message');
    
    if (errorElement) errorElement.classList.add('hidden');
    if (successElement) successElement.classList.add('hidden');

    if (password !== passwordConfirm) {
      if (errorElement) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.classList.remove('hidden');
      }
      return;
    }

    try {
      const response = await app.apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ 
          token, 
          password,
          passwordConfirm 
        })
      });

      if (successElement) {
        successElement.textContent = response.message;
        successElement.classList.remove('hidden');
      }

      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
      }
    }
  }

  async checkVerificationStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      try {
        const response = await app.apiRequest(`/auth/verify-email/${token}`);
        
        const verificationBox = document.getElementById('verification-box');
        if (verificationBox) {
          verificationBox.innerHTML = `
            <div class="verification-icon">✓</div>
            <h3>${response.message}</h3>
            <p class="text-muted mt-2">${app.t('check_email')}</p>
            <a href="/login.html" class="btn btn-primary mt-3">${app.t('login')}</a>
          `;
          verificationBox.classList.remove('hidden');
        }
      } catch (error) {
        const verificationBox = document.getElementById('verification-box');
        if (verificationBox) {
          verificationBox.innerHTML = `
            <div class="verification-icon" style="background: #FEE2E2; color: #EF4444;">✗</div>
            <h3>${error.message}</h3>
            <a href="/login.html" class="btn btn-primary mt-3">${app.t('login')}</a>
          `;
          verificationBox.classList.remove('hidden');
        }
      }
    }
  }

  checkResetToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm && !token) {
      resetForm.innerHTML = `
        <div class="auth-error">
          Invalid reset token
        </div>
        <a href="/login.html" class="btn btn-primary">${app.t('login')}</a>
      `;
    }
  }

  checkPasswordStrength(password) {
    const strengthBar = document.getElementById('password-strength-bar');
    const requirements = document.querySelectorAll('.password-requirements li');
    
    if (!strengthBar) return;

    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    strengthBar.className = 'password-strength-bar';
    
    if (passedChecks <= 2) {
      strengthBar.classList.add('strength-weak');
    } else if (passedChecks <= 4) {
      strengthBar.classList.add('strength-medium');
    } else {
      strengthBar.classList.add('strength-strong');
    }

    if (requirements) {
      const requirementChecks = [
        { element: requirements[0], valid: checks.length },
        { element: requirements[1], valid: checks.uppercase },
        { element: requirements[2], valid: checks.lowercase },
        { element: requirements[3], valid: checks.number },
        { element: requirements[4], valid: checks.special }
      ];

      requirementChecks.forEach(({ element, valid }) => {
        if (element) {
          if (valid) {
            element.classList.add('valid');
          } else {
            element.classList.remove('valid');
          }
        }
      });
    }
  }

  async logout() {
    try {
      await app.apiRequest('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      if (app.socket) {
        app.socket.disconnect();
      }
      app.currentUser = null;
      window.location.href = '/login.html';
    }
  }
}

const authManager = new AuthManager();
window.authManager = authManager;
