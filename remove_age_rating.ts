import fs from 'fs';

function removeAgeRating() {
  const constantsPath = 'constants.tsx';
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  // Remove lines with "ageRating": "..."
  const updatedContent = constantsContent.replace(/\s*"ageRating":\s*"[^"]*",?/g, '');
  
  fs.writeFileSync(constantsPath, updatedContent);
  console.log("Successfully removed ageRating from constants.tsx");
}

removeAgeRating();
