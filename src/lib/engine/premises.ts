import type { StoryFormat } from "./types";

export interface Premise {
  premise: string;
  rule: string;
  secret: string;
  format: StoryFormat;
  why: string;
}

/** Curated, original premises (used when no AI provider is configured). */
export const PREMISE_LIBRARY: Premise[] = [
  { premise: "In my town, nobody is allowed to look at the moon.", rule: "Anyone who looks at it disappears before sunrise.", secret: "The moon isn't taking people — it's calling them home.", format: "mystery_series", why: "A forbidden thing everyone can see." },
  { premise: "In my town, lying is impossible. The moment you tell a lie, your shadow disappears.", rule: "Lose your shadow and you're invisible in seven days.", secret: "The mayor steals shadows to hide his own lies.", format: "mystery_series", why: "Consequences you can see on screen." },
  { premise: "In my town, nobody is allowed to sleep before 9 PM.", rule: "Fall asleep early and you wake up in someone else's body.", secret: "The swaps aren't random. Someone chooses them.", format: "impossible_choice", why: "Everyone has fallen asleep too early." },
  { premise: "Every classroom in my school has a number. Except one.", rule: "Students who find classroom 13 stop existing in photographs.", secret: "The principal was its first student — and needs a replacement.", format: "strange_world", why: "Schools are relatable; erasure is terrifying." },
  { premise: "In my town, everything in the supermarket is free.", rule: "Every item you take removes one memory.", secret: "The memories are stocked on a shelf in the back.", format: "strange_world", why: "Free stuff with a hidden price." },
  { premise: "In my city, nobody can move when the traffic lights turn red.", rule: "Not even inside your home.", secret: "Red doesn't stop people — it stops time for everyone but one.", format: "mystery_series", why: "An everyday object turned into a threat." },
  { premise: "Every night at midnight, one house on my street disappears.", rule: "Nobody talks about the missing houses.", secret: "The houses aren't disappearing. The street is moving.", format: "mystery_series", why: "A slow countdown to your own front door." },
  { premise: "In my town, your birthday is decided by a lottery.", rule: "Lose three years in a row and you stop ageing.", secret: "The lottery winners are the ones who never grow up.", format: "impossible_choice", why: "A birthday that might never come." },
  { premise: "In my school, the lunch bell rings once for every lie told that morning.", rule: "If it rings more than ten times, the doors lock.", secret: "The bell isn't counting lies. It's counting the teachers'.", format: "strange_world", why: "A sound everyone recognises, made sinister." },
  { premise: "In my town, every phone receives one message from the future each Sunday.", rule: "Nobody is allowed to reply.", secret: "The messages come from the people who did.", format: "mystery_series", why: "Instant curiosity: what does mine say?" },
  { premise: "In my house, the mirrors show you one minute late.", rule: "Never look away from a mirror first.", secret: "Something else is using the missing minute.", format: "strange_world", why: "Everyone has a mirror in their room." },
  { premise: "In my city, it hasn't rained in forty years.", rule: "Umbrellas are illegal.", secret: "The rain was the only thing keeping the ground asleep.", format: "strange_world", why: "A rule that makes no sense until it does." },
  { premise: "In my town, you get one wish on your thirteenth birthday.", rule: "Whatever you wish for, someone else loses.", secret: "Every wish in town has been made by the same person.", format: "impossible_choice", why: "Every wish has a victim." },
  { premise: "In my school, the yearbook prints itself before the year starts.", rule: "Nobody is allowed to read the last page.", secret: "The last page is a list of who doesn't come back.", format: "mystery_series", why: "A book that knows the ending." },
];
