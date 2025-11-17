const adjectives = [
  "Quick",
  "Lazy",
  "Sleepy",
  "Happy",
  "Funny",
  "Crazy",
  "Angry",
  "Sunny",
  "Blue",
  "Red",
  "Green",
  "Flying",
  "Silent",
  "Wise",
  "Brave",
  "Kind",
];

const nouns = [
  "Fox",
  "Dog",
  "Cat",
  "Panda",
  "Tiger",
  "Lion",
  "Bear",
  "Wolf",
  "Eagle",
  "Shark",
  "Snake",
  "Rabbit",
  "Mango",
  "Apple",
  "Kiwi",
  "Pizza",
];

export function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}
