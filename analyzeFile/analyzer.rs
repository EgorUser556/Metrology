use std::io::{self, Write};
const MIN: i32 = 0;
const MAX: i32 = 100;
fn read_num(text: &str) -> i32 {
    loop {
        print!("{}", text);
        io::stdout().flush().unwrap();
        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();

        match input.trim().parse() {
            Ok(value) => return value,
            Err(_) => println!("Введите целое число."),
        }
    }
}
fn read_grade(number: i32) -> i32 {
    loop {
        let grade = read_num(&format!("Оценка №{}: ", number));

        if grade >= MIN && grade <= MAX {
            return grade;
        }
        println!("Допустимый диапазон: {}..{}.", MIN, MAX);
    }
}
fn average(sum: i32, count: i32) -> f64 {
    if count == 0 {
        return 0.0;
    }
    sum as f64 / count as f64
}

fn letter(value: f64) -> &'static str {
    if value >= 90.0 {
        "A"
    } else if value >= 75.0 {
        "B"
    } else if value >= 60.0 {
        "C"
    } else if value >= 40.0 {
        "D"
    } else {
        "F"
    }
}
fn above_average(grades: &[i32], avg: f64) -> i32 {
    let mut index = 0;
    let mut result = 0;

    while index < grades.len() {
        if grades[index] as f64 > avg {
            result += 1;
        }
        index += 1;
    }
    result
}
fn main() {
    println!("Анализ оценок");
    loop {
        let count = read_num("Количество оценок: ");
        if count <= 0 {
            println!("Количество должно быть больше нуля.");
            continue;
        }
        let mut grades = Vec::new();
        let mut sum = 0;
        let mut min = MAX;
        let mut max = MIN;
        for number in 1..=count {
            let grade = read_grade(number);
            grades.push(grade);
            sum += grade;
            if grade < min {
                min = grade;
            }
            if grade > max {
                max = grade;
            }
        }
        let avg = average(sum, count);
        println!("Среднее: {:.2}", avg);
        println!("Выше среднего: {}", above_average(&grades, avg));
        println!("Буквенная оценка: {}", letter(avg));
        let mut answer = String::new();
        print!("Повторить? (y/n): ");
        io::stdout().flush().unwrap();
        io::stdin().read_line(&mut answer).unwrap();
        match answer.trim() {
            "y" | "Y" => {}
            _ => break,
        }
    }
}