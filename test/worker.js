onmessage = function(e) {
  function* prime(currentInteger = 2, finalInteger = null) {
    function isPrime(integerToTest) {
      for (let i = 2; i < integerToTest; i++) {
        if (integerToTest%i === 0) {
          return false;
        }
      }
      return true;
    }  
    while (finalInteger === null || finalInteger > currentInteger) {
      if (isPrime(currentInteger++)) {
        yield currentInteger-1;
      }
    }
  }
  
  for(num of prime(e.data[0], e.data[1]))
    postMessage(num);
}
