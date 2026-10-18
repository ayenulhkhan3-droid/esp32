import { VoiceResultCommand } from '../types/commands';

const REPLIES: Record<VoiceResultCommand, string> = {
  forward: 'Car aage chal rahi hai.',
  backward: 'Car peeche ja rahi hai.',
  left: 'Car left mud rahi hai.',
  right: 'Car right mud rahi hai.',
  spin: 'Car ghoom rahi hai.',
  explore: 'Explore mode on. Car khud obstacle bachakar chalegi.',
  stop: 'Car rok di.',
  none: 'Command samajh nahi aaya. Dobara bolo.',
};

/** Local rule-based matching (no AI, no PHP). */
export function matchVoiceCommand(message: string): { command: VoiceResultCommand; reply: string } {
  const text = ` ${message
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

  const rules: { command: Exclude<VoiceResultCommand, 'none'>; words: string[] }[] = [
    {
      command: 'stop',
      words: [
        'stop', 'ruko', 'ruk', 'rok', 'roko', 'rukja', 'rukjao', 'band', 'bas', 'halt', 'brake',
        'रुको', 'रुक', 'रोको', 'रोक', 'बंद', 'बस', 'स्टॉप', 'थामो',
      ],
    },
    {
      command: 'explore',
      words: ['explore', 'auto', 'automatic', 'khud', 'apne aap', 'self drive', 'एक्सप्लोर', 'खुद', 'अपने आप', 'ऑटो'],
    },
    {
      command: 'spin',
      words: ['spin', 'ghumo', 'ghoomo', 'ghumao', 'ghoomao', 'chakkar', 'gol', 'rotate', 'round', 'घुमाओ', 'घूमो', 'घुमो', 'चक्कर', 'गोल', 'स्पिन'],
    },
    {
      command: 'backward',
      words: ['back', 'backward', 'backwards', 'reverse', 'peeche', 'piche', 'pichhe', 'peechhe', 'पीछे', 'पिछे', 'बैक', 'रिवर्स'],
    },
    {
      command: 'left',
      words: ['left', 'baye', 'bayen', 'baayen', 'baen', 'ulta', 'बाएं', 'बायें', 'बाये', 'लेफ्ट'],
    },
    {
      command: 'right',
      words: ['right', 'daye', 'dayen', 'daayen', 'daen', 'दाएं', 'दायें', 'दाये', 'राइट'],
    },
    {
      command: 'forward',
      words: ['forward', 'aage', 'age', 'aagey', 'agey', 'go', 'chalo', 'chalao', 'straight', 'seedha', 'sidha', 'आगे', 'चलो', 'चलाओ', 'सीधा', 'फॉरवर्ड'],
    },
  ];

  for (const { command, words } of rules) {
    for (const w of words) {
      if (text.includes(` ${w} `)) {
        return { command, reply: REPLIES[command] };
      }
    }
  }
  return { command: 'none', reply: REPLIES.none };
}
