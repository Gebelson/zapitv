async function test() {
  const res = await fetch('http://www.omdbapi.com/?i=tt17492148&apikey=a407a7b3');
  const data = await res.json();
  console.log(data);
}
test();
