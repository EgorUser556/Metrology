export const sampleRustCode = `
let mut result = 0;
let mut counter = 0;
let mode = 2;

if mode >= 0 {
    match mode {
        0 => {
            if result < 10 {
                while counter < 5 {
                    if counter % 2 == 0 {
                        result += counter;
                    } else {
                        result -= 1;
                    }

                    counter += 1;
                }
            }
        }

        1 | 2 => {
            for number in 0..5 {
                match number {
                    0 => {
                        if result == 0 {
                            result = 10;
                        }
                    }

                    1 | 2 => {
                        if result < 20 {
                            result += number;
                        } else {
                            result -= 1;
                        }
                    }

                    _ => {
                        result += 1;
                    }
                }
            }
        }

        _ => {
            loop {
                if counter >= 3 {
                    break;
                }

                counter += 1;
            }
        }
    }
}`;