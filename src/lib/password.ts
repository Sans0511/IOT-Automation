import { randomInt } from "node:crypto";

const PASSWORD_SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-+=",
] as const;

export function generateTemporaryPassword(length = 16): string {
  const characters = PASSWORD_SETS.map((set) => set[randomInt(set.length)]);
  const allCharacters = PASSWORD_SETS.join("");

  while (characters.length < length) {
    characters.push(allCharacters[randomInt(allCharacters.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}
