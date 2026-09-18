const fs = require('fs');

const path = 'src/components/RouteMap.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '          if (instructions && instructions.length > 0) {';
const endStr = '          }\n        }\n      });';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newLogic = `          if (instructions && instructions.length > 0) {
            const currentInstruction = instructions[0];
            const dist = currentInstruction.distance;
            const instructionText = currentInstruction.text;
            
            let stage = '';
            let textToSpeak = '';
            
            if (dist > 300) {
              // Too far
            } else if (dist <= 300 && dist > 100) {
              stage = 'anticipada';
              textToSpeak = "En " + (Math.round(dist/50)*50) + " metros, " + instructionText;
            } else if (dist <= 100 && dist > 30) {
              stage = 'proxima';
              textToSpeak = "Prepárese: " + instructionText;
            } else if (dist <= 30) {
              stage = 'inmediata';
              textToSpeak = "Ahora: " + instructionText;
            }
            
            const stageKey = instructionText + '|' + stage;
            
            if (textToSpeak && stageKey !== lastInstructionRef.current) {
              lastInstructionRef.current = stageKey;
              
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = 'es-MX';
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
              }
            }
`;
    content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    fs.writeFileSync(path, content);
    console.log("Successfully patched RouteMap.tsx");
} else {
    console.log("Tags not found");
}
