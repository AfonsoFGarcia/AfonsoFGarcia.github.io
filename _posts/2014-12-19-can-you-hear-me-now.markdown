---
layout: post
title:  "Can you hear me now?"
date:   2014-12-19 02:15:00
categories: programming java music
---

As James May once said,

> You have to start with hello!

If we generalize James' approach to speaking with attractive female human beings, you have to start with sound (although this may not be a recommended approach for that specific purpose).

During one of my bored moments, I thought about translating binary into musical notes. Yes, you can see that I clearly have some problems, but that's for some other day. It is actually quite simple, you have 7 different notes, which can easily be represented with 3 bits of information. Then I thought about how to generate a stream to convert into music and AES was the choice. Now, you can hear what you encrypt, it's magical (and pseudo-random, which is what I really wanted)!

But if you know your block ciphers, AES outputs 128 bits (using 128 bit keys) and 128 is not divisible by 3. However, it is divisible by 4. But then, I would be wasting one bit of information. Or would I? If you look at a piano keyboard, you will see 7 white keys and 5 black keys. Why should I limit my system to the 7 white keys? I decided to extend it to the 12 keys and now my bit was used. Then, I constructed a conversion table, from 4 bit binary to musical note.

|--------|--------------|
| Binary | Musical Note |
| 0000   | C            |
| 0001   | C#           |
| 0010   | D            |
| 0011   | D#           |
| 0100   | E            |
| 0101   | F            |
| 0110   | F#           |
| 0111   | G            |
| 1000   | G#           |
| 1001   | A            |
| 1010   | A#           |
| 1011   | B            |
| 1100   | B            |
| 1101   | B            |
| 1110   | B            |
| 1111   | B            |

Although this is not an optimal distribution of values, it was enough to do a proof of concept. It was now time to find a library capable of producing a MIDI representation of the encrypted value. Since Java has AES implemented in its standard library, I decided to use Java and a library called [JFugue](http://www.jfugue.org). It is really simple to use, all you have to do is to provide it with a string representation of what you want to play and it will play it. If you don't believe me, just look at this example from their documentation.

{% highlight java %}
Player player = new Player();
Pattern pattern = new Pattern("C D E F G A B");
player.play(pattern);
{% endhighlight %}

Now we can play musical notes from the command line. The next step is to setup the encryption routine. Since I didn't want to read the Crypto library documentation again, I just copied this routine from a Gist by [bricef](https://gist.github.com/bricef/2436364#file-aes-java).

{% highlight java %}
public static byte[] encrypt(String plainText) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding", "SunJCE");
    SecretKeySpec key = new SecretKeySpec(keyEnc.getBytes("UTF-8"), "AES");
    cipher.init(Cipher.ENCRYPT_MODE, key,new IvParameterSpec(IV.getBytes("UTF-8")));
    return cipher.doFinal(plainText.getBytes("UTF-8"));
}
{% endhighlight %}

This will encrypt `plainText` using AES in CBC mode and padding it to blocks of 128 bits to support random inputs, with the 128 bit key `keyEnc` and the initialization vector `IV` (both are attributes of the class).

The next step was to build the routine that would receive a byte and convert it to the correct note. Due to its simplicity I'm not going to show it here, but let's call it `byteToNote`. The tricky part was to pass the correct value to be converted. As you can see, the `encrypt` method will return a `byte[]`, and each byte has 8 bits, which is the double of what we need. That means that we need to do some bitwise operations to get 2 blocks of 4 bits from there.

{% highlight java %}
for(byte b: cipherText) {
    Integer b1 = b & 0x0f;		// Get the 4 least significant digits
    Integer b2 = (b >>> 4) & 0x0f;	// Get the 4 most significant digits
}
{% endhighlight %}

In this segment of code, we are separating the 8 bits into 2 portions of 4 bits each. This is done by applying a bitwise and operation between the byte and 00001111. This will return the 4 least significant digits of the number. To get the most significant digits, a bitwise shift right is done 4 times. It needs to be the bitwise shift right because if you apply the arithmetic shift right, it will keep the sign (and we want to treat this as if they were unsigned integers).

After implementing all this, I had sound being played from an AES ciphertext. But was this enough? Obviously not. There is space for so much improvements... Imagine that for some weird reason you wanted to send your ciphertext as a MIDI file. (And honestly, who could blame you? If I was an attacker, I would never think that that MIDI file you just sent contains your encrypted bank information.) Because of the way the conversion table is constructed, you cannot decrypt it. We can do better.

It turns out that MIDI is an interesting way of representing music. It supports 128 different notes (2^7, for those of you who don't know your powers of 2). A byte, on the other hand, can represent 2^8 numbers (256). This means that 1 bit of information could not be represented by using the 128 notes. However, 256/128=2. My first test was to represent each byte in MIDI, by using its value modulo 128 to get it between [0, 127]. Although this works, it doesn't produce an enjoyable sound (which is the primary goal) not is it decryptable (it represents 2 values using one).

So, to produce an enjoyable sound, I limited the values to [0, 63] and added 32 to them, giving the interval [32, 95]. This leaves 2 bits of the byte free for other uses. One interesting feature of JFugue is that you can change the duration of each note. As such, I decided that the 2 most significant bits would represent 4 different durations and the 6 least significant bits would represent the note. To represent a note in MIDI with JFugue, the string `[XXX]` is used, where `XXX` is the value in MIDI. As such, the `byteToNote` method was updated to give the note with the duration for a byte

{% highlight java %}
public static String byteToNote(byte b) {
	Integer modifier = (0xc0&b)/64;
	Integer value = (0x3f&b)+32;
	String ret = "[" + value + "]";

	switch(modifier) {
		case 0:
		default: return ret + "h ";
		case 1: return ret + "q ";
		case 2: return ret + "i ";
		case 3: return ret + "s ";
	}
}
{% endhighlight %}

Now, each byte is encoded in a unique way, that can be converted back to its byte interpretation, while producing a set of notes than can be easily listened to and in a way that isn't too repetitive. I've fulfilled both goals. MIDI also allows to define the instrument that should be synthesized when playing, so, just for fun, I wrote a method to set the instrument based on the first byte.

{% highlight java %}
public static String getInstrument(byte[] b) {
	String i = "I";
	Integer value = (0xff&b[0])%128;
	return i+value+" ";
}
{% endhighlight %}

However, you still cannot send your encrypted MIDI file. This was easy to implement, since JFugue supports writing the output to a file.

{% highlight java %}
player.saveMidi(pattern, new File("cryptosong.mid"));
{% endhighlight %}

And there you go. Now you can encrypt using AES and send it as a MIDI file or just generate some random "music" using AES encryption. If you are as mad as I am, you can even import that MIDI file to an audio software and tweak it to produce something that may be enjoyable. And if you want to check my full implementation of this, take a look at this [Gist](https://gist.github.com/AfonsoFGarcia/25773037a7d0a9e0db7e).

Next step: decryption of the MIDI file. But let's leave that for another post.