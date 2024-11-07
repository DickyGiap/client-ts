import { randomInt } from 'node:crypto';

export const getNonce = () => {
    return (BigInt(Date.now() + 20_000) << 20n) | BigInt(randomInt(1000, 30000));
}