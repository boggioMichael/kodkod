// Authors: Avi, Yossi, Moshe
public class Calc {
    // A: returns a + b
    static int add(int a, int b) {
        return a + b;
    }

    // B: returns a * b, using only add (repeated addition)
    static int mul(int a, int b) {
        int result = 0; for (int i = 0; i < b; i++) result = add(result, a); return result;
    }

    // C: returns a to the power of b, using only mul (repeated multiplication)
    static int power(int a, int b) {
        int result = 1; for (int i = 0; i < b; i++) result = mul(result, a); return result;
    }

    public static void main(String[] args) {
        System.out.println("2 + 3 = " + add(2, 3));
        System.out.println("3 * 4 = " + mul(3, 4));
        System.out.println("2 ^ 5 = " + power(2, 5));
    }
}
