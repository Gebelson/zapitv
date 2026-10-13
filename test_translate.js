import fs from 'fs';

async function testTranslate() {
  const text = "In 1999, a teen with a heart of gold begins keeping close tabs on a popular classmate as a favor to her smitten best friend.";
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`);
  const data = await res.json();
  console.log(data[0].map(x => x[0]).join(''));
}

testTranslate();
