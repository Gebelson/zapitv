/**
 * ZAPITV — SERVIÇO DE HASH SEGURO DE SENHAS (ARGON2ID)
 * 
 * Utiliza o algoritmo padrão da indústria Argon2id (OWASP & NIST recomendado)
 * com parâmetros de custo de tempo e memória calibrados para proteção contra
 * ataques de força bruta e GPU sem degradar a latência do servidor.
 * 
 * Regra de Segurança: Nunca registra senhas em texto puro em logs nem expõe hash ao cliente.
 */

import { hash, verify } from '@node-rs/argon2';

// Algorithm.Argon2id tem valor numérico 2 no @node-rs/argon2 (evita erro de const enum com isolatedModules)
const ARGON2_CONFIG = {
  algorithm: 2 as const,
  memoryCost: 19456, // 19 MB
  timeCost: 2,       // 2 iterações
  outputLen: 32,     // 256 bits de saída
  parallelism: 1
};

export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Senha inválida para hash.');
  }
  return await hash(plainPassword, ARGON2_CONFIG);
}

export async function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  if (!passwordHash || !plainPassword) return false;
  try {
    return await verify(passwordHash, plainPassword);
  } catch {
    return false;
  }
}
