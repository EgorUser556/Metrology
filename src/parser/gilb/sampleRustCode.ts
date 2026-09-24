export const sampleRustCode = `let mut result = 0;
let mut counter = 0;
let mode = 2;

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
    },

    1 | 2 => {
        for number in 0..5 {
            match number {
                0 => {
                    if result == 0 {
                        result = 10;
                    }
                },

                1 | 2 => {
                    while result < 20 {
                        if result % 2 == 0 {
                            result += 3;
                        } else {
                            result += 1;
                        }
                    }
                },

                _ => {
                    if number > 3 {
                        result += number;
                    }
                },
            }
        }
    },

    3 => {
        loop {
            if counter >= 3 {
                match result {
                    0 => {
                        if counter == 3 {
                            result = 30;
                        }
                    },

                    1 | 2 => {
                        while result < 10 {
                            result += 1;
                        }
                    },

                    _ => {
                        result += 5;
                    },
                }

                break;
            }

            counter += 1;
        }
    },

    _ => {
        if result < 0 {
            for number in 1..4 {
                if number % 2 == 0 {
                    result += number;
                } 
            }
        }
    },
}`;