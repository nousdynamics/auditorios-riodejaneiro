/**
 * Administradores iniciais do painel. O bootstrap cria cada um uma única vez (fica
 * registrado em settings como "initial_admin:<e-mail>"): se o usuário for excluído depois,
 * ele não volta sozinho. Só o hash PBKDF2 da senha temporária fica no código (o repositório
 * é público); as senhas foram entregues fora do repositório.
 *
 * Enquanto a senha do usuário for a temporária, o painel só libera a troca de senha.
 */
export const INITIAL_ADMINS = [
  {
    email: 'riodejaneiroauditorios@gmail.com',
    name: 'Auditório Rio de Janeiro',
    passwordHash: 'pbkdf2$100000$e9ZIV4Pr795EJvnS3KUdSQ$qHD0VNN3CasUD3-uwGiKhvxDyz6AR34dTlF8IE__cmA',
  },
  {
    email: 'nousdynamicslta@gmail.com',
    name: 'Nous Dynamics',
    passwordHash: 'pbkdf2$100000$uX-8ybj2YzsR8KLeVfh4Gw$ZXp8RHT4SqbjvEagExk0ky1iP236QRCWYbU4pY3Z0po',
  },
] as const;

const TEMPORARY_HASHES = new Set<string>(INITIAL_ADMINS.map((a) => a.passwordHash));

export const isTemporaryPassword = (passwordHash: string): boolean => TEMPORARY_HASHES.has(passwordHash);
