export const sampleRustCode = `fn classify(value: i32) -> i32 {
    let result = 0;

    match value {
        0 => { result = 10; },
        1 | 2 => { result = 20; },
        3 => { result = 30; },
        _ => { result = 40; },
    }

    return result;
}

fn main() {
    let mut sum = 0;

    for number in 1..=5 {
        if number % 2 == 0 {
            sum += number;
        } else {
            sum -= 1;
        }
    }

    let mut index = 0;

    while index < 3 {
        if sum > 0 {
            sum += classify(index);
        }
        index += 1;
    }

    loop {
        if sum >= 50 {
            break;
        }
        sum += 1;
    }
}`;