package expo.modules.pinkdf

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * PBKDF2-HMAC-SHA256 for the App Lock PIN. The same derivation runs in JavaScript otherwise
 * (@noble/hashes), but 600,000 rounds take far too long on Hermes; natively it takes about a
 * second, off the JS thread. The output is identical, so existing PINs keep working.
 */
class PinKdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PinKdf")

    // Async functions run on a background thread, so the UI stays responsive meanwhile.
    AsyncFunction("pbkdf2Sha256") { password: String, saltHex: String, iterations: Int, length: Int ->
      require(iterations > 0 && length in 1..64) { "Invalid PBKDF2 parameters" }
      toHex(derive(password.toByteArray(Charsets.UTF_8), fromHex(saltHex), iterations, length))
    }
  }

  // RFC 8018 section 5.2, using the platform's HMAC-SHA256.
  private fun derive(password: ByteArray, salt: ByteArray, iterations: Int, length: Int): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(password, "HmacSHA256"))
    val output = ByteArray(length)
    var offset = 0
    var block = 1
    while (offset < length) {
      mac.update(salt)
      mac.update(
        byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte())
      )
      var u = mac.doFinal()
      val t = u.copyOf()
      for (round in 1 until iterations) {
        u = mac.doFinal(u)
        for (i in t.indices) t[i] = (t[i].toInt() xor u[i].toInt()).toByte()
      }
      val count = minOf(t.size, length - offset)
      System.arraycopy(t, 0, output, offset, count)
      offset += count
      block++
    }
    password.fill(0)
    return output
  }

  private fun fromHex(value: String): ByteArray {
    require(value.length % 2 == 0) { "Invalid salt" }
    return ByteArray(value.length / 2) { index ->
      value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
    }
  }

  private fun toHex(bytes: ByteArray): String =
    bytes.joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
}
