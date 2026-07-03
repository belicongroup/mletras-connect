export type AuthLocale = 'en' | 'es';

export type AuthStrings = {
  email: string;
  next: string;
  forgotPassword: string;
  noAccount: string;
  hasAccount: string;
  signUp: string;
  signIn: string;
  emailRequired: string;
  emailInvalid: string;
  signInFailed: string;
  accountNotFound: string;
  createAccount: string;
  verifyEmail: string;
  resetPassword: string;
  verificationSent: string;
  sendingCode: string;
  verificationCode: string;
  verify: string;
  resendCode: string;
  resendCodeIn: (seconds: number) => string;
  codeRequired: string;
  forgotPasswordDescription: string;
  createPassword: string;
  createNewPassword: string;
  passwordDescription: string;
  password: string;
  confirmPassword: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  passwordMinLength: string;
  passwordUppercase: string;
  passwordLowercase: string;
  passwordNumber: string;
  passwordMismatch: string;
  passwordsMatch: string;
  passwordRequirementsTitle: string;
  profileTitle: string;
  profileSubtitle: string;
  username: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  firstName: string;
  lastName: string;
  optional: string;
  country: string;
  state: string;
  city: string;
  selectCountry: string;
  selectState: string;
  selectCity: string;
  selectCountryFirst: string;
  selectStateFirst: string;
  typeState: string;
  typeCity: string;
  joinFeed: string;
  usernameRequired: string;
  countryRequired: string;
  locationRequired: string;
  instrumentsRequired: string;
  usernameTaken: string;
  emailTakenSignup: string;
  emailSendFailed: string;
  tooManyRequests: string;
  createAccountFailed: string;
  updateFailed: string;
  instrumentsPlayed: string;
  countryUnitedStates: string;
  countryMexico: string;
  countryOther: string;
  usernamePermanentNote: string;
  usernameLockedHint: string;
  editProfile: string;
  profile: string;
  settings: string;
  notifications: string;
  noNotificationsYet: string;
  comments: string;
  commentPlaceholder: string;
  reply: string;
  send: string;
  noCommentsYet: string;
  commentedOnYourPost: string;
  repliedInThread: string;
  signOut: string;
  saveChanges: string;
  cancel: string;
  memberSince: string;
  noPostsYet: string;
  appearance: string;
  theme: string;
  dark: string;
  about: string;
  aboutDescription: string;
  language: string;
  deletePostConfirm: string;
  deletePost: string;
  deleteCommentConfirm: string;
  deleteComment: string;
  socialVideoTikTok: string;
  socialVideoInstagram: string;
  socialVideoFacebook: string;
  openSocialLink: string;
};

const en: AuthStrings = {
  email: 'Email',
  next: 'Next',
  forgotPassword: 'Forgot password?',
  noAccount: "Don't have an account?",
  hasAccount: 'Already have an account?',
  signUp: 'Sign up',
  signIn: 'Log in',
  emailRequired: 'Email is required.',
  emailInvalid: 'Enter a valid email address.',
  signInFailed: 'Sign in failed.',
  accountNotFound: 'No account found with that email.',
  createAccount: 'Create your account',
  verifyEmail: 'Verify your email',
  resetPassword: 'Reset your password',
  verificationSent: 'We sent a verification code to',
  sendingCode: 'Sending verification code…',
  verificationCode: 'Verification code',
  verify: 'Verify',
  resendCode: 'Resend code',
  resendCodeIn: (seconds) => `Resend code in ${seconds}s`,
  codeRequired: 'Enter the 6-digit verification code.',
  forgotPasswordDescription: 'Enter the email associated with your account.',
  createPassword: 'Create a password',
  createNewPassword: 'Create a new password',
  passwordDescription: 'Choose a secure password for',
  password: 'Password',
  confirmPassword: 'Confirm password',
  passwordPlaceholder: 'Enter your password',
  confirmPasswordPlaceholder: 'Re-enter your password',
  passwordMinLength: 'At least 8 characters',
  passwordUppercase: 'One uppercase letter',
  passwordLowercase: 'One lowercase letter',
  passwordNumber: 'One number',
  passwordMismatch: 'Passwords do not match.',
  passwordsMatch: 'Passwords match',
  passwordRequirementsTitle: 'Password requirements',
  profileTitle: 'Set up your profile',
  profileSubtitle: 'Tell the community who you are.',
  username: 'Username *',
  usernameLabel: 'Username',
  usernamePlaceholder: 'your_username',
  firstName: 'First name',
  lastName: 'Last name',
  optional: 'Optional',
  country: 'Country *',
  state: 'State *',
  city: 'City *',
  selectCountry: 'Select country',
  selectState: 'Select state',
  selectCity: 'Select city',
  selectCountryFirst: 'Select a country first',
  selectStateFirst: 'Select a state first',
  typeState: 'Type your state',
  typeCity: 'Type your city',
  joinFeed: 'Join the feed',
  usernameRequired: 'Username is required.',
  countryRequired: 'Country is required.',
  locationRequired: 'State and city are required.',
  instrumentsRequired: 'Select at least one instrument.',
  usernameTaken: 'That username is already taken.',
  emailTakenSignup: 'An account with this email already exists. Try logging in instead.',
  emailSendFailed: 'Could not send verification email. Please try again in a few minutes.',
  tooManyRequests: 'Too many attempts. Please wait a few minutes and try again.',
  createAccountFailed: 'Could not create account.',
  updateFailed: 'Could not save changes. Please try again.',
  instrumentsPlayed: 'Instruments played',
  countryUnitedStates: 'United States',
  countryMexico: 'Mexico',
  countryOther: 'Other',
  usernamePermanentNote: 'Your username is permanent and cannot be changed later.',
  usernameLockedHint: 'Usernames cannot be changed after signup.',
  editProfile: 'Edit Profile',
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
  noNotificationsYet: "You're all caught up.",
  comments: 'Comments',
  commentPlaceholder: 'Add a comment…',
  reply: 'Reply',
  send: 'Send',
  noCommentsYet: 'No comments yet. Be the first.',
  commentedOnYourPost: 'commented on your post',
  repliedInThread: 'also replied',
  signOut: 'Sign Out',
  saveChanges: 'Save changes',
  cancel: 'Cancel',
  memberSince: 'Member since',
  noPostsYet: 'No posts yet.',
  appearance: 'Appearance',
  theme: 'Theme',
  dark: 'Dark',
  about: 'About',
  aboutDescription:
    'MLetras Connect — your account and profile are stored securely and sync across sessions.',
  language: 'Language',
  deletePostConfirm: 'This will permanently remove this post. Are you sure?',
  deletePost: 'Delete post',
  deleteCommentConfirm: 'This will permanently remove this comment. Are you sure?',
  deleteComment: 'Delete comment',
  socialVideoTikTok: 'TikTok video',
  socialVideoInstagram: 'Instagram video',
  socialVideoFacebook: 'Facebook video',
  openSocialLink: 'Tap to open',
};

const es: AuthStrings = {
  email: 'Correo',
  next: 'Siguiente',
  forgotPassword: '¿Olvidaste tu contraseña?',
  noAccount: '¿No tienes una cuenta?',
  hasAccount: '¿Ya tienes una cuenta?',
  signUp: 'Regístrate',
  signIn: 'Inicia sesión',
  emailRequired: 'El correo es obligatorio.',
  emailInvalid: 'Ingresa un correo electrónico válido.',
  signInFailed: 'No se pudo iniciar sesión.',
  accountNotFound: 'No se encontró una cuenta con ese correo.',
  createAccount: 'Crea tu cuenta',
  verifyEmail: 'Verifica tu correo',
  resetPassword: 'Restablece tu contraseña',
  verificationSent: 'Enviamos un código de verificación a',
  sendingCode: 'Enviando código de verificación…',
  verificationCode: 'Código de verificación',
  verify: 'Verificar',
  resendCode: 'Reenviar código',
  resendCodeIn: (seconds) => `Reenviar código en ${seconds}s`,
  codeRequired: 'Ingresa el código de verificación de 6 dígitos.',
  forgotPasswordDescription: 'Ingresa el correo asociado a tu cuenta.',
  createPassword: 'Crea una contraseña',
  createNewPassword: 'Crea una nueva contraseña',
  passwordDescription: 'Elige una contraseña segura para',
  password: 'Contraseña',
  confirmPassword: 'Confirmar contraseña',
  passwordPlaceholder: 'Ingresa tu contraseña',
  confirmPasswordPlaceholder: 'Vuelve a ingresar tu contraseña',
  passwordMinLength: 'Al menos 8 caracteres',
  passwordUppercase: 'Una letra mayúscula',
  passwordLowercase: 'Una letra minúscula',
  passwordNumber: 'Un número',
  passwordMismatch: 'Las contraseñas no coinciden.',
  passwordsMatch: 'Las contraseñas coinciden',
  passwordRequirementsTitle: 'Requisitos de contraseña',
  profileTitle: 'Configura tu perfil',
  profileSubtitle: 'Cuéntale a la comunidad quién eres.',
  username: 'Usuario *',
  usernameLabel: 'Usuario',
  usernamePlaceholder: 'tu_usuario',
  firstName: 'Nombre',
  lastName: 'Apellido',
  optional: 'Opcional',
  country: 'País *',
  state: 'Estado *',
  city: 'Ciudad *',
  selectCountry: 'Selecciona un país',
  selectState: 'Selecciona un estado',
  selectCity: 'Selecciona una ciudad',
  selectCountryFirst: 'Selecciona un país primero',
  selectStateFirst: 'Selecciona un estado primero',
  typeState: 'Escribe tu estado',
  typeCity: 'Escribe tu ciudad',
  joinFeed: 'Unirme al feed',
  usernameRequired: 'El usuario es obligatorio.',
  countryRequired: 'El país es obligatorio.',
  locationRequired: 'El estado y la ciudad son obligatorios.',
  instrumentsRequired: 'Selecciona al menos un instrumento.',
  usernameTaken: 'Ese nombre de usuario ya está en uso.',
  emailTakenSignup: 'Ya existe una cuenta con este correo. Intenta iniciar sesión.',
  emailSendFailed: 'No se pudo enviar el correo de verificación. Inténtalo de nuevo en unos minutos.',
  tooManyRequests: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  createAccountFailed: 'No se pudo crear la cuenta.',
  updateFailed: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
  instrumentsPlayed: 'Instrumentos que tocas',
  countryUnitedStates: 'Estados Unidos',
  countryMexico: 'México',
  countryOther: 'Otro',
  usernamePermanentNote: 'Tu usuario es permanente y no se puede cambiar después.',
  usernameLockedHint: 'El usuario no se puede cambiar después del registro.',
  editProfile: 'Editar perfil',
  profile: 'Perfil',
  settings: 'Configuración',
  notifications: 'Notificaciones',
  noNotificationsYet: 'Estás al día.',
  comments: 'Comentarios',
  commentPlaceholder: 'Añade un comentario…',
  reply: 'Responder',
  send: 'Enviar',
  noCommentsYet: 'Aún no hay comentarios. Sé el primero.',
  commentedOnYourPost: 'comentó tu publicación',
  repliedInThread: 'también respondió',
  signOut: 'Cerrar sesión',
  saveChanges: 'Guardar cambios',
  cancel: 'Cancelar',
  memberSince: 'Miembro desde',
  noPostsYet: 'Aún no hay publicaciones.',
  appearance: 'Apariencia',
  theme: 'Tema',
  dark: 'Oscuro',
  about: 'Acerca de',
  aboutDescription:
    'MLetras Connect — tu cuenta y perfil se guardan de forma segura y se sincronizan entre sesiones.',
  language: 'Idioma',
  deletePostConfirm: 'Esto eliminará esta publicación de forma permanente. ¿Estás seguro?',
  deletePost: 'Eliminar publicación',
  deleteCommentConfirm: 'Esto eliminará este comentario de forma permanente. ¿Estás seguro?',
  deleteComment: 'Eliminar comentario',
  socialVideoTikTok: 'Video de TikTok',
  socialVideoInstagram: 'Video de Instagram',
  socialVideoFacebook: 'Video de Facebook',
  openSocialLink: 'Toca para abrir',
};

export const AUTH_STRINGS: Record<AuthLocale, AuthStrings> = { en, es };

export function getAuthStrings(locale: AuthLocale): AuthStrings {
  return AUTH_STRINGS[locale];
}

// Legacy export for non-hook usage during migration
export const authStrings = en;
