/**
 * Primeiro administrador do painel. Criado uma única vez, pelo bootstrap, quando o banco
 * ainda não tem nenhum usuário. Só o hash PBKDF2 da senha temporária fica no código (o
 * repositório é público); a senha foi entregue fora do repositório.
 *
 * Enquanto a senha do usuário for esta temporária, o painel só libera a troca de senha.
 */
export const INITIAL_ADMIN = {
  email: 'riodejaneiroauditorios@gmail.com',
  name: 'Auditório Rio de Janeiro',
  passwordHash: 'pbkdf2$100000$e9ZIV4Pr795EJvnS3KUdSQ$qHD0VNN3CasUD3-uwGiKhvxDyz6AR34dTlF8IE__cmA',
} as const;

export const isTemporaryPassword = (passwordHash: string): boolean => passwordHash === INITIAL_ADMIN.passwordHash;
