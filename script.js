class RationalApproximator {
    constructor() {
        this.numberInput = document.getElementById('numberInput');
        this.randomBtn = document.getElementById('randomBtn');
        this.resultsDiv = document.getElementById('results');
        this.sortType = 'error'; // 'error', 'denominator', or 'comprehensive'
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.numberInput.addEventListener('input', () => {
            this.updateResults();
        });
        
        this.randomBtn.addEventListener('click', () => {
            this.generateRandomNumber();
        });
    }
    
    generateRandomNumber() {
        const randomNum = Math.random(); // 0 to 1
        this.numberInput.value = randomNum.toFixed(10); // 小数点10位まで
        this.updateResults();
    }
    
    updateResults() {
        const inputValue = this.numberInput.value.trim();
        
        if (!inputValue || isNaN(inputValue)) {
            this.displayNoResults();
            return;
        }
        
        const number = parseFloat(inputValue);
        const approximations = this.findRationalApproximations(number);
        this.displayResults(approximations, number);
    }
    
    /**
     * 小数を既約分数で近似するアルゴリズム
     * 
     * このアルゴリズムは2つの手法を組み合わせて最適な既約分数を見つける ：
     * 
     * 手法1: 連分数展開による近似
     * - 数学的に最も効率的な近似を提供
     * - 小さな分母で高精度な近似が可能
     * 
     * 手法2: 総当たり探索による近似
     * - 小さい分母から順番に試して、既約分数のみを選別
     * - 連分数で見つからない組み合わせも発見
     */
    findRationalApproximations(x, maxDenominator = 1000) {
        const results = [];
        
        // === 手法1: 連分数展開による高精度近似 ===
        // 連分数は数値を [a0; a1, a2, a3, ...] の形で表現
        // 例: π ≈ [3; 7, 15, 1, 292, ...] → 3 + 1/(7 + 1/(15 + 1/(1 + ...)))
        const continuedFraction = this.toContinuedFraction(x, 10);
        const convergents = this.getConvergents(continuedFraction);
        
        // 連分数の収束値（convergents）は自動的に既約分数になる性質がある
        for (const [num, den] of convergents) {
            if (den <= maxDenominator) {
                const error = Math.abs(x - num / den);
                results.push({ numerator: num, denominator: den, error: error });
            }
        }
        
        // === 手法2: 総当たり探索による補完的な近似 ===
        // 連分数では見つからない可能性のある組み合わせをカバー
        for (let den = 1; den <= 100; den++) {
            const num = Math.round(x * den);
            
            // === 既約分数の判定プロセス ===
            // ステップ1: 分子と分母の最大公約数(GCD)を計算
            // ステップ2: GCDが1の場合のみ既約分数として採用
            // 
            // 理由: 既約分数とは分子と分母に1以外の共通因数を持たない分数
            // 例: 6/9 は GCD(6,9)=3 なので既約分数ではない → 2/3 に約分される
            // 例: 2/3 は GCD(2,3)=1 なので既約分数
            if (this.gcd(Math.abs(num), den) === 1) { // 既約分数のみ
                const error = Math.abs(x - num / den);
                const exists = results.some(r => 
                    r.numerator === num && r.denominator === den
                );
                if (!exists) {
                    results.push({ numerator: num, denominator: den, error: error });
                }
            }
        }

        // 総合評価スコアを計算
        results.forEach(result => {
            result.comprehensiveScore = this.calculateComprehensiveScore(result.error, result.denominator);
            result.lengthPrecisionScore = this.calculateLengthPrecisionScore(result.numerator, result.denominator, result.error);
            result.precisionRank = this.getPrecisionRank(result.error);
            result.totalLen = Math.abs(result.numerator).toString().length + Math.abs(result.denominator).toString().length;
        });

        // ソート方法に応じてソート
        if (this.sortType === 'error') {
            results.sort((a, b) => a.error - b.error);
        } else if (this.sortType === 'denominator') {
            results.sort((a, b) => a.denominator - b.denominator);
        } else if (this.sortType === 'comprehensive') {
            results.sort((a, b) => b.comprehensiveScore - a.comprehensiveScore); // 高いスコア順
        } else if (this.sortType === 'lengthPrecision') {
            results.sort((a, b) => b.lengthPrecisionScore - a.lengthPrecisionScore); // 高いスコア順
        } else if (this.sortType === 'precisionThenShorter') {
            // 誤差（有効数字）降順、同じなら合計文字数昇順
            results.sort((a, b) => {
                if (b.precisionRank !== a.precisionRank) {
                    return b.precisionRank - a.precisionRank;
                }
                return a.totalLen - b.totalLen;
            });
        }

        return results.slice(0, 15); // 上位15個まで表示
    }

    // 有効数字による誤差ランク（大きいほど誤差が高い）
    getPrecisionRank(error) {
        if (error === 0) return 10;
        const significantDigits = Math.floor(-Math.log10(error));
        return significantDigits;
    }

    /**
     * 分母・分子の合計文字数と有効数字による誤差を合わせたスコア
     * - 誤差スコア: 有効数字が多いほど高い（最大10点）
     * - 分母・分子の合計文字数が少ないほど高い（最大10点、最小2点程度）
     * - スコア = 誤差スコア × (1 + 2 * exp(分母文字数+分子文字数))
     */
    calculateLengthPrecisionScore(numerator, denominator, error) {
        // 誤差スコア（有効数字ベース）
        let precisionScore;
        if (error === 0) {
            precisionScore = 10;
        } else {
            const significantDigits = Math.floor(-Math.log10(error));
            if (significantDigits <= 1) {
                precisionScore = 1;
            } else if (significantDigits === 2) {
                precisionScore = 3;
            } else if (significantDigits === 3) {
                precisionScore = 5;
            } else if (significantDigits === 4) {
                precisionScore = 8;
            } else if (significantDigits === 5) {
                precisionScore = 9;
            } else {
                precisionScore = 10;
            }
        }
        // 分母・分子の合計文字数
        const numLen = Math.abs(numerator).toString().length;
        const denLen = Math.abs(denominator).toString().length;
        const totalLen = numLen + denLen;
        // スコア計算（合計文字数が小さいほど高い）
        const score = precisionScore / (1 + 2 * Math.exp(totalLen - 4)); // 5文字以下で高スコア、10文字以上で低スコア
        return score;
    }
    
    calculateComprehensiveScore(error, denominator) {
        // 有効数字ベースの誤差評価
        let errorScore;
        if (error === 0) {
            errorScore = 10; // 完全一致
        } else {
            // 誤差の有効桁数を計算（先頭の0を除く）
            const significantDigits = Math.floor(-Math.log10(error));
            
            if (significantDigits <= 1) {
                // 1桁以下：極めて低評価
                errorScore = 1;
            } else if (significantDigits === 2) {
                // 2桁一致：低評価
                errorScore = 3;
            } else if (significantDigits === 3) {
                // 3桁一致：少し評価上がる
                errorScore = 5;
            } else if (significantDigits === 4) {
                // 4桁一致：80点レベル
                errorScore = 8;
            } else if (significantDigits === 5) {
                // 5桁一致：90点レベル
                errorScore = 9;
            } else {
                // 6桁以上一致：ほぼ100点
                errorScore = 10;
            }
        }
        
        // 分母スコアを調整
        let denominatorScore = 10 / (1 + Math.exp((denominator - 50) / 10));
        
        // 掛け算による総合評価（どちらか一方が低いと全体が低くなる）
        const weightedScore = (errorScore * denominatorScore) / 10; // 10で割って0-10の範囲に正規化
        
        return weightedScore;
    }
    
    toContinuedFraction(x, maxTerms) {
        const result = [];
        let current = Math.abs(x);
        
        for (let i = 0; i < maxTerms && current !== 0; i++) {
            const integerPart = Math.floor(current);
            result.push(integerPart);
            current = current - integerPart;
            
            if (Math.abs(current) < 1e-10) break;
            current = 1 / current;
        }
        
        return x < 0 ? [-result[0], ...result.slice(1)] : result;
    }
    
    getConvergents(continuedFraction) {
        const convergents = [];
        let h_prev2 = 0, h_prev1 = 1;
        let k_prev2 = 1, k_prev1 = 0;
        
        for (const a of continuedFraction) {
            const h = a * h_prev1 + h_prev2;
            const k = a * k_prev1 + k_prev2;
            
            convergents.push([h, k]);
            
            h_prev2 = h_prev1;
            h_prev1 = h;
            k_prev2 = k_prev1;
            k_prev1 = k;
        }
        
        return convergents;
    }
    
    /**
     * 最大公約数(Greatest Common Divisor, GCD)を計算するユークリッドの互除法
     * 
     * アルゴリズムの仕組み:
     * 1. 二つの数 a, b について、a を b で割った余りを r とする
     * 2. もし r が 0 なら、b が最大公約数
     * 3. そうでなければ、a = b, b = r として手順1に戻る
     * 
     * 例: gcd(12, 8)
     * - 12 ÷ 8 = 1 余り 4  → a=8, b=4
     * - 8 ÷ 4 = 2 余り 0   → b=4 が最大公約数
     * 
     * 既約分数の判定:
     * - 分子と分母のGCDが1なら既約分数
     * - 例: 3/4 → gcd(3,4)=1 → 既約分数
     * - 例: 6/8 → gcd(6,8)=2 → 既約分数ではない（3/4に約分可能）
     */
    gcd(a, b) {
        while (b !== 0) {
            [a, b] = [b, a % b]; // 分割代入でaとbを入れ替えつつ、bに余りを代入
        }
        return a;
    }
    
    displayResults(approximations, originalNumber) {
        if (approximations.length === 0) {
            this.displayNoResults();
            return;
        }

        // コピー通知用の要素を追加
        let html = '<div id="copy-toast" style="display:none;position:fixed;top:30px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:12px 28px;border-radius:8px;font-size:16px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15);">コピーしました！</div>';

        html += '<div class="results-header">';
        html += '<h3>近似分数候補</h3>';
        html += '<div class="sort-buttons">';
        html += `<button class="sort-btn ${this.sortType === 'error' ? 'active' : ''}" onclick="app.changeSortType('error')">誤差順</button>`;
        html += `<button class="sort-btn ${this.sortType === 'denominator' ? 'active' : ''}" onclick="app.changeSortType('denominator')">分母順</button>`;
        html += `<button class="sort-btn ${this.sortType === 'comprehensive' ? 'active' : ''}" onclick="app.changeSortType('comprehensive')">総合評価順</button>`;
        html += `<button class="sort-btn ${this.sortType === 'lengthPrecision' ? 'active' : ''}" onclick="app.changeSortType('lengthPrecision')">桁数×誤差順</button>`;
        html += `<button class="sort-btn ${this.sortType === 'precisionThenShorter' ? 'active' : ''}" onclick="app.changeSortType('precisionThenShorter')">誤差→短さ順</button>`;
        html += '</div>';
        html += '</div>';
        html += '<div class="results-grid">';

        approximations.forEach((approx, index) => {
            const { numerator, denominator, error, comprehensiveScore, lengthPrecisionScore, precisionRank, totalLen } = approx;
            const decimalValue = (numerator / denominator).toFixed(6);
            const latexString = `\\frac{${numerator}}{${denominator}}`;

            // data-latex属性にLaTeX文字列を埋め込む
            html += `<div class="result-item" data-latex="${latexString.replace(/"/g, '&quot;')}" title="クリックでLaTeXコピー">`;
            html += `<div class="fraction" id="fraction-${index}"></div>`;
            html += `<div class="decimal">≈ ${decimalValue}</div>`;
            html += `<div class="error">誤差: ${error.toExponential(3)}</div>`;

            if (this.sortType === 'comprehensive') {
                html += `<div class="score">総合評価: ${comprehensiveScore.toFixed(2)}</div>`;
            }
            if (this.sortType === 'lengthPrecision') {
                html += `<div class="score">桁数×誤差: ${lengthPrecisionScore.toFixed(2)}</div>`;
            }
            if (this.sortType === 'precisionThenShorter') {
                html += `<div class="score">誤差: ${precisionRank}桁, 合計文字数: ${totalLen}</div>`;
            }

            html += '</div>';
        });

        html += '</div>';
        this.resultsDiv.innerHTML = html;

        // KaTeXで各分数を個別にレンダリング
        approximations.forEach((approx, index) => {
            const { numerator, denominator } = approx;
            const latexString = `\\frac{${numerator}}{${denominator}}`;
            const fractionElement = document.getElementById('fraction-' + index);
            if (fractionElement) {
                katex.render(latexString, fractionElement);
            }
        });

        // クリックでLaTeXコピー機能＋トースト表示
        const toast = document.getElementById('copy-toast');
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const latex = item.getAttribute('data-latex');
                if (latex) {
                    navigator.clipboard.writeText(latex).then(() => {
                        // トースト表示
                        if (toast) {
                            toast.style.display = 'block';
                            setTimeout(() => {
                                toast.style.display = 'none';
                            }, 1000);
                        }
                        item.classList.add('copied');
                        item.title = "コピーしました！";
                        setTimeout(() => {
                            item.classList.remove('copied');
                            item.title = "クリックでLaTeXコピー";
                        }, 1000);
                    });
                }
                e.stopPropagation();
            });
        });
    }

    changeSortType(newSortType) {
        this.sortType = newSortType;
        this.updateResults();
    }
    
    displayNoResults() {
        this.resultsDiv.innerHTML = '<div class="no-results">数値を入力してください</div>';
    }
}

// アプリケーション初期化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RationalApproximator();
});
