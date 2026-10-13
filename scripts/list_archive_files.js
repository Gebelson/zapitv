async function listFiles() {
  const res = await fetch('https://archive.org/metadata/night_of_the_living_dead');
  const data = await res.json();
  const formats = Array.from(new Set((data.files || []).map(f => f.format || f.name.split('.').pop())));
  console.log('Available formats/extensions:', formats);
  const sampleVideoFiles = (data.files || []).filter(f => /video|ogv|mp4|mkv|avi|webm/i.test(f.format || f.name));
  console.log('Video files:', sampleVideoFiles.map(f => ({ name: f.name, format: f.format, size: f.size })));
}
listFiles();
