/**
 * Hand-written story kits for the template engine. Each one is an original
 * story built on the storytelling framework: a hook, a world rule (and its
 * five questions), a protagonist with something to lose, three-level
 * escalation, a discovery, one primary twist and a continuation device.
 *
 * Placeholders: {P} protagonist, {F} rule-breaker/friend, {A} authority, {S} secret keeper.
 */
import type { Beat, EndingDevice, EnvironmentKind, PropKind, SfxKind, StorySheet, TimeOfDay, TwistType } from "./types";

export interface KitScene {
  beat: Beat;
  line: string;
  env: EnvironmentKind;
  time?: TimeOfDay;
  props?: PropKind[];
  propText?: string;
  sfx?: SfxKind[];
  /** Who is on screen and how. "P" | "F" | "A" | "S". */
  cast?: { who: "P" | "F" | "A" | "S"; action?: string; expression?: string; noShadow?: boolean; fading?: boolean; label?: string }[];
  dialogue?: { who: "P" | "F" | "A" | "S"; line: string };
  choice?: { question: string; options: [string, string] };
}

export interface StoryKit {
  id: string;
  match: RegExp;
  title: string;
  mood: "mysterious" | "tense" | "epic" | "chill" | "playful";
  sheet: Omit<StorySheet, "protagonist" | "escalation"> & { protagonist: Omit<StorySheet["protagonist"], "name">; escalation: [string, string, string] };
  /** Scene list for 60s. 30s keeps the scenes marked core; 90s adds the extras. */
  scenes: (KitScene & { core?: boolean })[];
  extras: (KitScene & { after: Beat })[];
}

const T = (twistType: TwistType, endingDevice: EndingDevice) => ({ twistType, endingDevice });

export const KITS: StoryKit[] = [
  {
    id: "moon",
    match: /\bmoon\b/i,
    title: "Don't Look at the Moon",
    mood: "mysterious",
    sheet: {
      premise: "In my town, nobody is allowed to look at the moon.",
      rule: "Everyone must keep their eyes down at night, otherwise they disappear before sunrise.",
      whyObey: "Every family has lost someone who looked.",
      breakConsequence: "You're gone before sunrise. No body, no trace.",
      beneficiary: "{A}, who keeps the town's curtains closed and the streets dark.",
      secret: "The moon isn't taking people. It's calling them home.",
      protagonist: { desire: "To keep my little brother safe.", vulnerability: "He's all the family I have left.", secret: "I've seen him drawing the moon every night." },
      conflict: "My little brother has been drawing the moon every night.",
      escalation: ["His drawings started appearing on everyone's windows.", "Last night, they appeared on ours — from the outside.", "Every drawing showed the same thing: our mother, standing on the moon."],
      mystery: "Why does my brother know what our mother looked like? He was a baby when she left.",
      ...T("rule_reversal", "unexpected_arrival"),
      twist: "The moon wasn't making people disappear. It was calling them home.",
      endingType: "open_loop",
      ending: "Then my mother knocked on the window. She was outside, pointing up.",
      continuation: "But my mother has been gone for twelve years.",
    },
    scenes: [
      { beat: "hook", core: true, line: "In my town, nobody is allowed to look at the moon.", env: "town_street", time: "night", props: ["moon"], sfx: ["whoosh"], cast: [{ who: "P", action: "idle", expression: "neutral" }] },
      { beat: "rule", core: true, line: "Anyone who looks at it disappears before sunrise. No body. No goodbye.", env: "town_street", time: "night", props: ["moon", "sign"], propText: "EYES DOWN AFTER DARK", cast: [{ who: "A", action: "point", expression: "angry" }] },
      { beat: "character", line: "But my little brother has been drawing the moon every night.", env: "bedroom", time: "night", props: ["photo"], cast: [{ who: "F", action: "sit", expression: "happy" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "escalation_1", line: "Yesterday, his drawings started appearing on everyone's windows.", env: "town_street", time: "sunset", props: ["crowd"], sfx: ["footsteps"], cast: [{ who: "P", action: "look_up", expression: "shocked" }] },
      { beat: "escalation_2", core: true, line: "Last night, one appeared on ours. Drawn from the outside.", env: "bedroom", time: "night", props: ["moon", "flicker_lights"], sfx: ["heartbeat"], cast: [{ who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "escalation_3", line: "Every drawing was the same. A woman, standing on the moon.", env: "town_street", time: "night", props: ["moon", "fog"], cast: [{ who: "P", action: "look_up", expression: "sad" }] },
      { beat: "discovery", line: "Then I found an old photograph. It was our mother. On the moon.", env: "bedroom", time: "night", props: ["photo"], cast: [{ who: "P", action: "give", expression: "shocked" }] },
      { beat: "twist", core: true, line: "The moon wasn't making people disappear. It was calling them home.", env: "town_street", time: "night", props: ["moon", "sparkles"], sfx: ["impact"], cast: [{ who: "P", action: "look_up", expression: "shocked" }] },
      { beat: "cliffhanger", core: true, line: "Then someone knocked on the window. It was my mother. She was pointing up.", env: "bedroom", time: "night", props: ["moon", "open_door"], sfx: ["knock"], cast: [{ who: "S", action: "point", expression: "neutral" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "continuation", line: "But my mother has been gone for twelve years.", env: "bedroom", time: "night", props: ["moon"], sfx: ["heartbeat"], cast: [{ who: "P", action: "idle", expression: "shocked" }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "He's all the family I have left. I can't lose him too.", env: "bedroom", time: "night", cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { after: "escalation_2", beat: "escalation_2", line: "My brother just smiled. He said she told him where to draw them.", env: "bedroom", time: "night", dialogue: { who: "F", line: "She said you'd come too." }, cast: [{ who: "F", action: "talk", expression: "happy" }] },
      { after: "discovery", beat: "discovery", line: "On the back, in her handwriting: Don't let them keep your eyes down.", env: "bedroom", time: "night", props: ["photo"], cast: [{ who: "P", action: "idle", expression: "sad" }] },
    ],
  },
  {
    id: "shadow",
    match: /\b(lie|lies|lying|liar|shadows?)\b/i,
    title: "The Shadow Thief",
    mood: "tense",
    sheet: {
      premise: "In my town, lying is impossible. The moment you tell a lie, your shadow disappears.",
      rule: "Everyone must tell the truth, otherwise their shadow vanishes — and seven days later, so do they.",
      whyObey: "Everyone has watched someone fade away.",
      breakConsequence: "No shadow, then invisible to everyone after seven days.",
      beneficiary: "{A}, the mayor, who has never lost his shadow.",
      secret: "{A} isn't immune. He steals other people's shadows to hide his own lies.",
      protagonist: { desire: "To find out what happened to my dad.", vulnerability: "If I'm wrong about him, I lose the last good thing I believe.", secret: "I don't believe my dad ever lied." },
      conflict: "My best friend lost her shadow. She swears she didn't lie.",
      escalation: ["{F} lost her shadow, and she swears she never lied.", "Then I noticed the mayor's shadow moves a second late.", "Everyone in town says {A} has never told a lie. Not once."],
      mystery: "How can a man who's never lied have the wrong shadow?",
      ...T("betrayal", "new_revelation"),
      twist: "The mayor isn't immune. He's been stealing other people's shadows to hide his own lies.",
      endingType: "open_loop",
      ending: "I asked him where my dad was. He said: your father is the reason this town has a truth rule.",
      continuation: "Then I looked down. My shadow was gone.",
    },
    scenes: [
      { beat: "hook", core: true, line: "In my town, lying is impossible. The moment you tell a lie, your shadow disappears.", env: "town_street", time: "day", sfx: ["whoosh"], cast: [{ who: "P", action: "idle", expression: "neutral" }] },
      { beat: "rule", core: true, line: "Seven days later, nobody can see you at all.", env: "city_plaza", time: "day", props: ["sign", "crowd"], propText: "TELL THE TRUTH", cast: [{ who: "A", action: "wave", expression: "smug" }] },
      { beat: "character", line: "My dad disappeared two years ago. They said he lied. I never believed them.", env: "bedroom", time: "sunset", props: ["photo"], cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { beat: "escalation_1", core: true, line: "Then my best friend lost her shadow. She swears she didn't lie.", env: "school_hall", time: "day", cast: [{ who: "F", action: "shocked", expression: "shocked", noShadow: true }, { who: "P", action: "idle", expression: "shocked" }], dialogue: { who: "F", line: "I didn't lie. I promise." } },
      { beat: "escalation_2", line: "Day three. Her teachers stopped calling her name.", env: "school_hall", time: "day", props: ["flicker_lights"], sfx: ["heartbeat"], cast: [{ who: "F", action: "sad", expression: "sad", noShadow: true, fading: true }] },
      { beat: "escalation_3", line: "Then I saw the mayor in the sunlight. His shadow moved a second too late.", env: "city_plaza", time: "day", sfx: ["glitch"], cast: [{ who: "A", action: "idle", expression: "smug" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "discovery", line: "His office was full of jars. Each one held a shadow. One had my dad's name on it.", env: "office", time: "night", props: ["letter", "flicker_lights"], cast: [{ who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "twist", core: true, line: "The mayor wasn't immune. He was stealing our shadows to hide his own lies.", env: "office", time: "night", sfx: ["impact"], cast: [{ who: "A", action: "point", expression: "angry" }] },
      { beat: "cliffhanger", core: true, line: "I asked him where my dad was. He said my dad is the reason this town has a truth rule.", env: "office", time: "night", dialogue: { who: "A", line: "Ask your father why." }, cast: [{ who: "A", action: "talk", expression: "smug" }, { who: "P", action: "shocked", expression: "angry" }] },
      { beat: "continuation", core: true, line: "Then I looked down. My shadow was gone.", env: "office", time: "night", sfx: ["heartbeat"], cast: [{ who: "P", action: "shocked", expression: "shocked", noShadow: true }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "If my dad really lied, then everything I remember about him is wrong.", env: "bedroom", time: "sunset", cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { after: "escalation_2", beat: "escalation_2", line: "Day five. Her mum set the table for three instead of four.", env: "bedroom", time: "sunset", cast: [{ who: "F", action: "sad", expression: "sad", noShadow: true, fading: true }] },
      { after: "discovery", beat: "discovery", line: "My friend's jar was still warm.", env: "office", time: "night", props: ["flicker_lights"], cast: [{ who: "P", action: "give", expression: "shocked" }] },
    ],
  },
  {
    id: "sleep",
    match: /\b(sleep|asleep|someone else'?s body)\b/i,
    title: "Lights Out at Nine",
    mood: "mysterious",
    sheet: {
      premise: "In my town, nobody is allowed to sleep before 9 PM.",
      rule: "Everyone must stay awake until nine, otherwise they wake up in someone else's body.",
      whyObey: "Nobody wants to wake up as a stranger.",
      breakConsequence: "You wake up in a random body. Someone else wakes up in yours.",
      beneficiary: "{S}, who runs the only all-night café and knows everyone's sleeping habits.",
      secret: "The swaps aren't random. Someone has been choosing them.",
      protagonist: { desire: "To get my own body back.", vulnerability: "Nobody believes I'm really me.", secret: "I fell asleep on purpose." },
      conflict: "I fell asleep at 8:59.",
      escalation: ["I woke up as {A}, the town's strictest teacher.", "My real body was walking to school without me.", "And it was being nicer to my friends than I ever was."],
      mystery: "Why did it feel like the swap was waiting for me?",
      ...T("perspective", "impossible_decision"),
      twist: "Nobody stole my body. The person in it is who I'd be if I stopped being afraid.",
      endingType: "open_loop",
      ending: "Tonight at nine, I can switch back. Or I can let them stay.",
      continuation: "Which one of us should wake up tomorrow?",
    },
    scenes: [
      { beat: "hook", core: true, line: "In my town, nobody is allowed to sleep before 9 PM.", env: "town_street", time: "sunset", sfx: ["whoosh"], cast: [{ who: "P", action: "idle", expression: "sleepy" }] },
      { beat: "rule", core: true, line: "If you do, you wake up in someone else's body.", env: "bedroom", time: "night", props: ["sign"], propText: "STAY AWAKE TILL 9", cast: [{ who: "P", action: "shrug", expression: "neutral" }] },
      { beat: "character", line: "Everyone at school is better than me at something. I just wanted one day as someone else.", env: "school_hall", time: "day", cast: [{ who: "P", action: "sad", expression: "sad" }, { who: "F", action: "walk_across", expression: "happy" }] },
      { beat: "escalation_1", core: true, line: "So I fell asleep at 8:59. I woke up as {A}. The strictest teacher in town.", env: "bedroom", time: "day", sfx: ["glitch"], cast: [{ who: "A", action: "shocked", expression: "shocked" }] },
      { beat: "escalation_2", line: "And my real body was already walking to school. Without me.", env: "town_street", time: "day", sfx: ["footsteps"], cast: [{ who: "P", action: "walk_across", expression: "happy" }, { who: "A", action: "shocked", expression: "shocked" }] },
      { beat: "escalation_3", line: "By lunch, my friends liked the new me more than they ever liked the real one.", env: "school_hall", time: "day", props: ["crowd"], cast: [{ who: "P", action: "celebrate", expression: "happy" }, { who: "F", action: "celebrate", expression: "happy" }] },
      { beat: "discovery", line: "Then {S} slid me a note. It said: you asked for this, remember?", env: "store", time: "night", props: ["letter"], cast: [{ who: "S", action: "give", expression: "neutral" }, { who: "A", action: "idle", expression: "shocked" }] },
      { beat: "twist", core: true, line: "Nobody stole my body. The person in it is who I'd be if I stopped being scared.", env: "school_hall", time: "sunset", sfx: ["impact"], cast: [{ who: "P", action: "wave", expression: "happy" }] },
      { beat: "cliffhanger", core: true, line: "Tonight at nine, I can switch back. Or I can let them stay.", env: "bedroom", time: "night", choice: { question: "Which one of us wakes up tomorrow?", options: ["Switch back", "Let them stay"] }, sfx: ["drumroll"], cast: [{ who: "A", action: "idle", expression: "sad" }] },
      { beat: "continuation", line: "The clock just hit 8:59. And the new me is already lying down.", env: "bedroom", time: "night", sfx: ["heartbeat"], cast: [{ who: "P", action: "sleep", expression: "sleepy" }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "My mum says I'm too careful to ever get in trouble. She's right. That's the problem.", env: "bedroom", time: "sunset", cast: [{ who: "P", action: "shrug", expression: "sad" }] },
      { after: "escalation_2", beat: "escalation_2", line: "I tried telling my friend it was me. She called security.", env: "school_hall", time: "day", dialogue: { who: "F", line: "Sir, you're being really weird." }, cast: [{ who: "F", action: "talk", expression: "angry" }, { who: "A", action: "shrug", expression: "sad" }] },
      { after: "discovery", beat: "discovery", line: "The note was in my handwriting.", env: "store", time: "night", props: ["letter"], cast: [{ who: "A", action: "shocked", expression: "shocked" }] },
    ],
  },
  {
    id: "classroom13",
    match: /\bclassroom\b|\b13\b|\bthirteen\b/i,
    title: "Classroom 13",
    mood: "tense",
    sheet: {
      premise: "Every classroom in my school has a number. Except one.",
      rule: "Everyone must ignore the unnumbered door, otherwise they stop existing in photographs.",
      whyObey: "Old yearbooks are full of empty spaces where kids used to be.",
      breakConsequence: "You vanish from every photo. Then people start forgetting you.",
      beneficiary: "{A}, the principal, who has worked here for sixty years and never aged.",
      secret: "Classroom 13 isn't erasing students. It's keeping them.",
      protagonist: { desire: "To prove my best friend was real.", vulnerability: "I'm the only one who still remembers him.", secret: "I have the last photo he's still in." },
      conflict: "My best friend found the door.",
      escalation: ["He vanished from the class photo.", "Then from his family's photos.", "Then his mum asked me who I was talking about."],
      mystery: "Why is the principal in every yearbook since 1960, looking exactly the same?",
      ...T("loop", "time_pressure"),
      twist: "The principal isn't guarding Classroom 13. He's its first student — and he's been looking for a replacement.",
      endingType: "open_loop",
      ending: "The door has my number on it now. 13.",
      continuation: "And my photo is starting to fade.",
    },
    scenes: [
      { beat: "hook", core: true, line: "Every classroom in my school has a number. Except one.", env: "school_hall", time: "day", sfx: ["whoosh"], cast: [{ who: "P", action: "idle", expression: "neutral" }] },
      { beat: "rule", core: true, line: "Students who find classroom 13 stop existing in photographs.", env: "school_hall", time: "day", props: ["photo", "sign"], propText: "DO NOT ENTER", cast: [{ who: "A", action: "point", expression: "angry" }] },
      { beat: "character", line: "My best friend {F} said rules like that are just stories to scare kids.", env: "school_hall", time: "day", dialogue: { who: "F", line: "It's just a door." }, cast: [{ who: "F", action: "talk", expression: "smug" }, { who: "P", action: "idle", expression: "neutral" }] },
      { beat: "escalation_1", core: true, line: "The next morning, he was missing from the class photo.", env: "school_hall", time: "day", props: ["photo"], sfx: ["glitch"], cast: [{ who: "P", action: "give", expression: "shocked" }] },
      { beat: "escalation_2", line: "Then from his family's photos. Then his mum asked who I was talking about.", env: "town_street", time: "sunset", cast: [{ who: "P", action: "shocked", expression: "sad" }] },
      { beat: "escalation_3", line: "I was the only person left who remembered him.", env: "school_hall", time: "night", props: ["flicker_lights"], sfx: ["heartbeat"], cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { beat: "discovery", line: "Then I found the principal in a yearbook from 1960. Same face. Same tie.", env: "office", time: "night", props: ["photo"], cast: [{ who: "A", action: "idle", expression: "smug" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "twist", core: true, line: "He isn't guarding classroom 13. He was its first student. And he needs a replacement.", env: "school_hall", time: "night", props: ["open_door", "fog"], sfx: ["impact"], cast: [{ who: "A", action: "point", expression: "smug" }] },
      { beat: "cliffhanger", core: true, line: "This morning, the door had a number on it. Mine.", env: "school_hall", time: "night", props: ["open_door", "sign"], propText: "13", sfx: ["door_creak"], cast: [{ who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "continuation", line: "And I'm already fading out of my own photos.", env: "bedroom", time: "night", props: ["photo"], sfx: ["heartbeat"], cast: [{ who: "P", action: "look_up", expression: "sad", fading: true }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "He's the only person who ever sat next to me on purpose.", env: "school_hall", time: "day", cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { after: "escalation_2", beat: "escalation_2", line: "His locker had someone else's name on it. It always had, they said.", env: "school_hall", time: "day", cast: [{ who: "P", action: "point", expression: "angry" }] },
      { after: "discovery", beat: "discovery", line: "In every photo, he was standing in front of the same door.", env: "office", time: "night", props: ["photo"], cast: [{ who: "P", action: "give", expression: "shocked" }] },
    ],
  },
  {
    id: "supermarket",
    match: /\bsupermarket\b|\b(store|shop)\b.*\bfree\b|\bmemor(y|ies)\b/i,
    title: "Everything Is Free",
    mood: "mysterious",
    sheet: {
      premise: "In my town, everything in the supermarket is free.",
      rule: "Everyone can take whatever they want, but every item takes away one memory.",
      whyObey: "It's the only food in town. Everyone pays eventually.",
      breakConsequence: "Take too much and you forget who you are.",
      beneficiary: "{A}, the store manager, who remembers everything.",
      secret: "The memories aren't destroyed. They're being stocked on a shelf at the back.",
      protagonist: { desire: "To feed my little sister.", vulnerability: "I'm running out of memories of our mum.", secret: "I've been paying for both of us." },
      conflict: "I can't remember my mum's voice anymore.",
      escalation: ["I forgot her birthday.", "Then I forgot her face.", "Then my sister forgot me."],
      mystery: "Why does the back aisle hum when I walk past it?",
      ...T("consequence", "new_danger"),
      twist: "I broke into the back aisle and took my memories back. But they weren't all mine.",
      endingType: "open_loop",
      ending: "I remember things that never happened to me. Things the manager did.",
      continuation: "And now he knows exactly what I remember.",
    },
    scenes: [
      { beat: "hook", core: true, line: "In my town, everything in the supermarket is free.", env: "store", time: "day", sfx: ["ding"], cast: [{ who: "P", action: "wave", expression: "happy" }] },
      { beat: "rule", core: true, line: "But every item you take removes one memory.", env: "store", time: "day", props: ["sign"], propText: "1 ITEM = 1 MEMORY", cast: [{ who: "A", action: "idle", expression: "smug" }] },
      { beat: "character", line: "I shop for my little sister too. So I pay double.", env: "store", time: "day", cast: [{ who: "P", action: "give", expression: "sad" }, { who: "F", action: "idle", expression: "happy" }] },
      { beat: "escalation_1", core: true, line: "Last week, I forgot my mum's birthday. This week, her voice.", env: "bedroom", time: "sunset", props: ["photo"], cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { beat: "escalation_2", line: "Then my sister looked at me and asked who I was.", env: "bedroom", time: "night", dialogue: { who: "F", line: "Do I know you?" }, sfx: ["heartbeat"], cast: [{ who: "F", action: "talk", expression: "neutral" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "escalation_3", line: "The manager just smiled and gave her a free bag of sweets.", env: "store", time: "day", cast: [{ who: "A", action: "give", expression: "smug" }, { who: "F", action: "celebrate", expression: "happy" }] },
      { beat: "discovery", line: "At night, the back aisle glows. The shelves are full of jars. Each one is a memory.", env: "store", time: "night", props: ["flicker_lights", "sparkles"], cast: [{ who: "P", action: "look_up", expression: "shocked" }] },
      { beat: "twist", core: true, line: "I took my memories back. But I took the wrong jar. Now I remember everything the manager did.", env: "store", time: "night", props: ["sparkles"], sfx: ["impact"], cast: [{ who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "cliffhanger", core: true, line: "The lights came on. The manager was standing in the aisle.", env: "store", time: "night", props: ["flicker_lights"], sfx: ["footsteps"], cast: [{ who: "A", action: "walk_in_right", expression: "angry" }, { who: "P", action: "shocked", expression: "shocked" }] },
      { beat: "continuation", line: "He said: so you know what's in the basement now.", env: "store", time: "night", dialogue: { who: "A", line: "Store's closed." }, sfx: ["heartbeat"], cast: [{ who: "A", action: "talk", expression: "smug" }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "She doesn't know. She thinks the shop just likes us.", env: "store", time: "day", cast: [{ who: "F", action: "dance", expression: "happy" }] },
      { after: "escalation_2", beat: "escalation_2", line: "I showed her our photo. She said I looked nice.", env: "bedroom", time: "night", props: ["photo"], cast: [{ who: "P", action: "give", expression: "sad" }] },
      { after: "discovery", beat: "discovery", line: "One jar had my mum's name on it. It was empty.", env: "store", time: "night", props: ["flicker_lights"], cast: [{ who: "P", action: "sad", expression: "sad" }] },
    ],
  },
  {
    id: "redlight",
    match: /\b(red light|traffic|freeze|frozen|can'?t move)/i,
    title: "Red Light City",
    mood: "tense",
    sheet: {
      premise: "In my city, nobody can move when the traffic lights turn red. Not even inside their homes.",
      rule: "Everyone freezes on red, otherwise the lights find you.",
      whyObey: "Nobody chooses to freeze. Your body just stops.",
      breakConsequence: "People who move on red are never seen again.",
      beneficiary: "{A}, the city controller, who sets the lights.",
      secret: "The lights don't stop people. They stop time — for everyone except the controller.",
      protagonist: { desire: "To get my sister to the hospital in time.", vulnerability: "Her medicine runs out tonight.", secret: "I can move on red. I've never told anyone." },
      conflict: "The lights turned red for an entire hour.",
      escalation: ["Everyone froze mid-step. Except me.", "Then I saw someone else moving.", "It was {A}, walking between the frozen people, taking things."],
      mystery: "Why can I move when nobody else can?",
      ...T("identity", "time_pressure"),
      twist: "I can move on red because I'm the controller's daughter. He froze my mum the day I was born.",
      endingType: "open_loop",
      ending: "He turned and looked straight at me. And smiled.",
      continuation: "The light is about to turn green. I have ten seconds.",
    },
    scenes: [
      { beat: "hook", core: true, line: "In my city, nobody can move when the traffic lights turn red.", env: "town_street", time: "day", props: ["traffic_light"], sfx: ["whoosh"], cast: [{ who: "P", action: "walk_across", expression: "neutral" }] },
      { beat: "rule", core: true, line: "Not on the road. Not even inside your home. Your body just stops.", env: "bedroom", time: "day", props: ["traffic_light"], cast: [{ who: "F", action: "idle", expression: "shocked" }] },
      { beat: "character", line: "My sister's medicine runs out tonight. The hospital is twelve lights away.", env: "bedroom", time: "sunset", cast: [{ who: "F", action: "sit", expression: "sad" }, { who: "P", action: "idle", expression: "sad" }] },
      { beat: "escalation_1", core: true, line: "Tonight, every light in the city turned red. For an hour.", env: "city_plaza", time: "night", props: ["traffic_light", "crowd"], sfx: ["alarm"], cast: [{ who: "P", action: "idle", expression: "shocked" }] },
      { beat: "escalation_2", line: "Everyone froze. Except me.", env: "city_plaza", time: "night", props: ["traffic_light", "crowd"], cast: [{ who: "P", action: "run", expression: "shocked" }] },
      { beat: "escalation_3", line: "Then I saw someone else moving. The city controller. Taking things from frozen people.", env: "city_plaza", time: "night", props: ["traffic_light", "crowd", "fog"], sfx: ["footsteps"], cast: [{ who: "A", action: "walk_across", expression: "smug" }] },
      { beat: "discovery", line: "In his pocket was a photo of a baby. Of me.", env: "city_plaza", time: "night", props: ["photo"], cast: [{ who: "P", action: "give", expression: "shocked" }] },
      { beat: "twist", core: true, line: "I can move on red because I'm his daughter. He froze my mum the day I was born.", env: "city_plaza", time: "night", props: ["traffic_light"], sfx: ["impact"], cast: [{ who: "A", action: "idle", expression: "neutral" }, { who: "P", action: "shocked", expression: "angry" }] },
      { beat: "cliffhanger", core: true, line: "He turned around and looked straight at me. And smiled.", env: "city_plaza", time: "night", props: ["traffic_light"], dialogue: { who: "A", line: "Took you long enough." }, cast: [{ who: "A", action: "talk", expression: "smug" }] },
      { beat: "continuation", line: "The light is about to turn green. I have ten seconds.", env: "city_plaza", time: "night", props: ["traffic_light"], sfx: ["heartbeat"], cast: [{ who: "P", action: "run", expression: "shocked" }] },
    ],
    extras: [
      { after: "character", beat: "character", line: "I've never told anyone I can move on red. Not even her.", env: "bedroom", time: "sunset", cast: [{ who: "P", action: "sad", expression: "sad" }] },
      { after: "escalation_2", beat: "escalation_2", line: "A man was frozen mid-sneeze. A bird was stuck in the air.", env: "town_street", time: "night", props: ["traffic_light", "crowd"], cast: [{ who: "P", action: "walk_across", expression: "shocked" }] },
      { after: "discovery", beat: "discovery", line: "On the back: our first red light.", env: "city_plaza", time: "night", props: ["photo"], cast: [{ who: "P", action: "sad", expression: "sad" }] },
    ],
  },
];
