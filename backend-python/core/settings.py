import os
from pathlib import Path

# --- BASE CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent.parent

# Check if running in production (Set DJANGO_ENV='production' in Cloud Run)
IS_PRODUCTION = os.getenv('DJANGO_ENV') == 'production'

# Use a safe default for dev, but expect env var in prod
SECRET_KEY = os.getenv('SECRET_KEY', "django-insecure-m)))+19a55@zz_)9)zj&488fx$o#rh2f!1i#_xvz5_wv*e4%*l")

DEBUG = not IS_PRODUCTION

ALLOWED_HOSTS = ['*']

# --- APPLICATIONS ---
INSTALLED_APPS = [
    # Django Defaults
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",

    # Third Party
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",

    # Local
    "videos",
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # Must be high up
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"
SITE_ID = 1

# --- DATABASE ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --- SECURITY & CORS ---
if IS_PRODUCTION:
    # Production Settings (Cloud Run)
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOW_CREDENTIALS = True
    
    # Add your Firebase/Cloud URLs here when you deploy
    # Example: CORS_ALLOWED_ORIGINS = ["https://your-frontend.web.app"]
    CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', "").split(",")
    CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', "").split(",")

    # HTTPS Enforcement
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # Callback URL for Google Login
    FRONTEND_URL = os.getenv('FRONTEND_URL', "https://your-app.web.app")

else:
    # Local Development (iPad/Hotspot Friendly)
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
    
    # Trust local IPs for Login
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173", 
    ]

    # Disable HTTPS checks for local LAN
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'http'
    
    FRONTEND_URL = "http://localhost:5173"


# --- AUTHENTICATION ---
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    )
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'watchparty-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'watchparty-refresh',
    'JWT_AUTH_SECURE': IS_PRODUCTION, # Auto-toggle based on env
    'JWT_AUTH_SAMESITE': 'Lax',
}

# AllAuth Configuration
ACCOUNT_LOGIN_METHODS = {'username'}
ACCOUNT_SIGNUP_FIELDS = ['username', 'email']
ACCOUNT_EMAIL_VERIFICATION = 'none'

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- TEMPLATES ---
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- STATIC & MEDIA ---
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "static/"
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')