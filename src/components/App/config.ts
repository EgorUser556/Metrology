const INITIAL_CODE = `fn main() {
    let mut sum = 0;

    for number in 1..=5 {
        sum += number;
    }

    if sum > 10 {
        println!("Сумма больше 10: {}", sum);
    }
}`;

export default INITIAL_CODE;