var canvas = document.getElementById('canvas'),
    context = canvas.getContext('2d');
var Start = document.getElementById('Start'),
    Undo = document.getElementById('Undo'),
    Turn = document.getElementById('Turn');

var gamestart = false; //为了判断是否点击new game按钮
var undo = true;  //为了游戏结束时不能再进行撤销所设立的flag
var over = false; //为了游戏结束后左边的框框不再提示轮到哪方落子所设立的flag
var winflag = false; //为了游戏结束之后鼠标移动时不再有红框框跟随所设立的flag

//离屏canvas用于解决红框框暂留问题
//每次绘制都同时绘制到两个canvas
var offcanvas = document.createElement("canvas");
var offcontext = offcanvas.getContext("2d");
offcanvas.width = canvas.width;
offcanvas.height = canvas.height;

//这里数组下标均从1开始 方便计算
var chessList = []; //已下的棋子对象数组 每个对象有三个属性[{x y p}]
var chessCount = 0; //已下棋子的个数
var data = []; //二维棋盘数组
//对二维棋盘数组初始化
for (var i = 1; i < 16; i++) {
    data[i] = [];
    for (var j = 1; j < 16; j++)
        data[i][j] = 0;//data数组保存棋子状态 0表示无棋子
}

var image = new Image();
var continueCount;   //连续棋子个数
// Function................................................

//画棋盘的函数  为了看起来舒服 不设置棋盘颜色可选 默认为黑色
function drawGrid(context, stepx, stepy) {
    context.save();
    context.strokeStyle = 'black';
    context.lineWidth = 1;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    for (var i = stepx + 1; i < context.canvas.width; i += stepx) {
        context.beginPath();
        context.moveTo(i, stepx);
        context.lineTo(i, context.canvas.height - stepy);
        context.stroke();
    }
    for (var i = stepy + 1; i < context.canvas.height; i += stepy) {
        context.beginPath();
        context.moveTo(stepy, i);
        context.lineTo(context.canvas.width - stepx, i);
        context.stroke();
    }
    context.restore();
}

//画背景五小子的函数  （百度棋盘后发现 棋盘上五个地方有黑色小圆  也看到过有九个小子的  这里就以五个为例）
//因为数目不多  所以就直接画了  没有另外调用函数
function drawblackcircle(context) {
    context.beginPath();
    context.arc(125, 125, 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(125, 375, 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(375, 125, 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(375, 375, 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(250, 250, 5, 0, Math.PI * 2);
    context.fill();
}

//画棋子  player代表棋子颜色 1是黑旗 -1是白棋（为了交换顺序时便于写代码 只需*（-1）即可）
// x,y是棋子坐标,坐标轴同canvas坐标数字是1到15  目的相同
function drawPoint(context, player, x, y) {
    var f1, f2;
    //在画棋子的时候 用到了createRadialGradient 径向渐变 六个参数分别表示起点坐标和半径 终点坐标和半径
    if (player === 1) {
        f1 = "black";
        f2 = context.createRadialGradient(31.25 * x + 5, 31.25 * y - 5, 0, 31.25 * x + 5, 31.25 * y - 5, 16);
        f2.addColorStop(0, 'white');
        f2.addColorStop(1, 'black');
    } else {
        f1 = "#c1c1c1";
        f2 = context.createRadialGradient(31.25 * x + 5, 31.25 * y - 5, 0, 31.25 * x + 5, 31.25 * y - 5, 16);
        f2.addColorStop(0, 'white');
        f2.addColorStop(1, '#c1c1c1');
    }
    context.save();
    context.beginPath();
    context.arc(31.25 * x, 31.25 * y, 15.625, 0, Math.PI * 2, false);
    context.fillStyle = f1;
    context.fill();

    context.beginPath();
    context.arc(31.25 * x, 31.25 * y, 15.625, 0, Math.PI * 2, false);
    context.clip();
    context.beginPath();
    context.arc(31.25 * x + 5, 31.25 * y - 5, 15.625, 0, Math.PI * 2, false);
    context.fillStyle = f2;
    context.fill();
    context.restore();
}

//读取坐标的函数
function windowToCanvas(x, y) {
    var box = canvas.getBoundingClientRect();
    var style = window.getComputedStyle(canvas);
    var width = parseFloat(style["width"]);
    var height = parseFloat(style["height"]);
    var left = box.left;
    var top = box.top;
    var pl = parseFloat(style["padding-left"]);
    var pt = parseFloat(style["padding-top"]);
    var bl = parseFloat(style["border-left-width"]);
    var bt = parseFloat(style["border-top-width"]);
    return {
        x: (x - left - pl - bl) * (canvas.width / box.width),
        y: (y - top - pt - bt) * (canvas.height / box.height)
    };
}

//这个函数为了下面的判断是否有五子连线 函数目的是看对应坐标下是否有棋子  若没有 则返回null
function getChess(xIndex, yIndex, player) {
    for (var i = 1; i < chessCount; i++) {
        if (chessList[i] && chessList[i].x === xIndex && chessList[i].y === yIndex && chessList[i].p === player)
            return chessList[i];
    }
    return null;
}

//这个函数是判断黑棋或者白棋是否有五子连线  从当下棋子出发 有四条线可以是五子连线  但要从八个方向进行判断
function isWin() {
    continueCount = 1;//连续棋子的个数
    if (chessCount > 0) {
        //以下三个是为了得到当前所下棋子的坐标和颜色
        var xIndex = chessList[chessCount].x;
        var yIndex = chessList[chessCount].y;
        var p = chessList[chessCount].p;
    }

    //向各个方向判断是否有棋子时，如果有棋子，连续棋子的个数+1，一直到找到null 跳出for循环
    // 然后判断continueCount的值是否为5  若不是则置为1  进行另一条线的判断

    //横线五子
    //向左寻找
    for (var x = xIndex - 1; x > 0; x--) {
        if (getChess(x, yIndex, p) != null)
            continueCount++;
        else
            break;
    }
    //向右寻找
    for (var x = xIndex + 1; x < 16; x++) {
        if (getChess(x, yIndex, p) != null)
            continueCount++;
        else
            break;
    }

    if (continueCount >= 5)
        return true;
    else
        continueCount = 1;

    //竖线五子
    //向上寻找
    for (var y = yIndex - 1; y > 0; y--) {
        if (getChess(xIndex, y, p) != null)
            continueCount++;
        else
            break;
    }
    //向下寻找
    for (var y = yIndex + 1; y < 16; y++) {
        if (getChess(xIndex, y, p) != null)
            continueCount++;
        else
            break;
    }

    if (continueCount >= 5)
        return true;
    else
        continueCount = 1;

    //斜线五子
    //向右上寻找
    for (var x = xIndex + 1, y = yIndex - 1; x < 16 && y > 0; x++, y--) {
        if (getChess(x, y, p) != null)
            continueCount++;
        else
            break;
    }
    //向左下寻找
    for (var x = xIndex - 1, y = yIndex + 1; x > 0 && y < 16; x--, y++) {
        if (getChess(x, y, p) != null)
            continueCount++;
        else
            break;
    }

    if (continueCount >= 5)
        return true;
    else
        continueCount = 1;

    //反斜线五子
    //向左上寻找
    for (var x = xIndex - 1, y = yIndex - 1; x > 0 && y > 0; x--, y--) {
        if (getChess(x, y, p) != null)
            continueCount++;
        else
            break;
    }
    //向右下寻找
    for (var x = xIndex + 1, y = yIndex + 1; x < 16 && y < 16; x++, y++) {
        if (getChess(x, y, p) != null)
            continueCount++;
        else
            break;
    }

    if (continueCount >= 5)
        return true;
    else
        continueCount = 1;

}

function gameover() {
    gamestart = false; //将gamestart设置为false 在游戏结束后不能再在棋盘上下棋
    undo = false; //将undo设置为false  在游戏结束后不能再进行悔棋
    over = true; //将over设置为true 在游戏结束后左边框框不再提示落子顺序 公布结果
    winflag = true;  //游戏结束时 winflag设置为true 为了红框框不再出现
    //游戏结束时 会有花瓣飘落
    $(document).snowfall('clear');
    $(document).snowfall({
        image: "花瓣/images/huaban.png",
        flakeCount: 50,
        minSize: 5,
        maxSize: 20
    });
    // var winner = -1?"Black":"White";
    // alert("Gameover!The winner is"+winner);
}

//接下来的部分是事件响应部分

var player = 1; //默认黑棋先走
canvas.onclick = function (e) {
    if (gamestart === true) {                    // 当gamestart为true时  可以在棋盘上下棋
        //坐标从1到15 都是整数 所以读取canvas坐标后 要除以31.25并进行四舍五入
        loc = windowToCanvas(e.clientX, e.clientY);
        loc.x = parseInt(loc.x / 31.25 + 0.5);//+0.5四舍五入
        loc.y = parseInt(loc.y / 31.25 + 0.5);
        console.log(loc);

        if (loc.x > 0 && loc.y > 0 && loc.x < 16 && loc.y < 16 && data[loc.x][loc.y] === 0) {  //画棋子的前提条件
            drawPoint(context, player, loc.x, loc.y);
            drawPoint(offcontext, player, loc.x, loc.y);
            chessList[++chessCount] = {x: loc.x, y: loc.y, p: player};
            if (isWin()) {
                gameover();
                //offcanvas跟canvas的区别是offcanvas上面没有红框框 所以清除canvas 绘制offcanvas   棋盘上出现所有下过的棋子但是没有红框框
                //游戏结束时只需在最后所下棋子处绘制红框框即可
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(offcanvas, 0, 0);
                context.beginPath();
                context.strokeStyle = "red";
                context.strokeRect(31.25 * chessList[chessCount].x - 15.625, 31.25 * chessList[chessCount].y - 15.625, 31.25, 31.25);
            }
            if (chessCount === 225) {
                winflag = true;  //winflag设置为true 为了红框框不再出现
                gamestart = false; //将gamestart设置为false 和棋后不能再在棋盘上下棋
                undo = false; //将undo设置为false  在和棋后不能再进行悔棋
                Turn.style.color = "red";
                Turn.innerHTML = "Draw";
                return;
            }
            data[loc.x][loc.y] = player;          //在棋盘数组里保存数据
            player *= -1;                           //黑白棋子交换顺序
            //大的if else 是判断游戏是否结束从而左边框框显示不同的内容
            // 游戏未结束时显示轮到哪方落子 结束时则显示最终结果
            if (over === true) {
                if (player === 1) {
                    Turn.style.color = "white";
                    Turn.innerHTML = "White wins";
                } else {
                    Turn.style.color = "Black";
                    Turn.innerHTML = "Black wins";
                }
            } else {
                if (player === 1) {
                    Turn.style.color = "black";
                    Turn.innerHTML = "Black's turn";
                } else {
                    Turn.style.color = "white";
                    Turn.innerHTML = "White's turn";
                }
            }
        }
    }
};

//当鼠标在棋盘内移动时 会有大小跟棋盘格子一样的红色的矩形框随着鼠标移动  方便确认位置
//当鼠标按下时 即在棋盘上下棋时 红框框依旧存在 同时在鼠标继续移动到下下一个棋的过程中 红框框随鼠标移动
canvas.onmousemove = function (e) {
    if(gamestart === true) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(offcanvas, 0, 0);
        //在上一步下棋位置绘制红框框  当游戏结束的时候 不再绘制
        if (chessCount > 0 && winflag === false) {
            context.beginPath();
            context.strokeStyle = "red";
            context.strokeRect(31.25 * chessList[chessCount].x - 15.625, 31.25 * chessList[chessCount].y - 15.625, 31.25, 31.25);
        }

        loc = windowToCanvas(e.clientX, e.clientY);
        loc.x = parseInt(loc.x / 31.25 + 0.5);      //+0.5四舍五入
        loc.y = parseInt(loc.y / 31.25 + 0.5);
        //在鼠标当前可以落子的位置绘制红框框  当游戏结束的时候 不再绘制
        if (31.25 * loc.x - 15.625 > 0 && 31.25 * loc.y - 15.625 > 0
            && 31.25 * loc.x + 15.625 < canvas.width
            && 31.25 * loc.y + 15.625 < canvas.height && data[loc.x][loc.y] === 0 && winflag === false) {
            context.beginPath();
            context.strokeStyle = "red";
            context.strokeRect(31.25 * loc.x - 15.625, 31.25 * loc.y - 15.625, 31.25, 31.25);
        }
    }
};

//点击New Game按钮时开始新的游戏
Start.onclick = function (e) {
    gamestart = true;        //将gamestart设置为true 可以重新在棋盘上下棋
    $(document).snowfall('clear'); //清除花瓣
    context.clearRect(0, 0, canvas.width, canvas.height);
    offcontext.clearRect(0, 0, offcanvas.width, offcanvas.height);   //清除之前的痕迹
    drawGrid(context, 31.25, 31.25);
    drawGrid(offcontext, 31.25, 31.25);
    drawblackcircle(context);
    drawblackcircle(offcontext);     //绘制新的背景
    chessCount = 0;
    for (var i = 1; i < 16; i++) {
        data[i] = [];
        for (var j = 1; j < 16; j++)
            data[i][j] = 0;
    }                                  //重置chessCount 和 data数组
    Turn.style.color = "black";
    Turn.innerHTML = "Black's turn";  //将左边的框框显示初始化值  始终默认从黑棋开始
    player = 1;                          //默认从黑棋开始  所以player的值为1
    undo = true;                        //将undo设置为true 可以继续进行悔棋操作
    winflag = false;                   //将winflag设置为false，在新游戏开始的时候 红框框重新出现
    over = false;                      //将over设置为false 在新游戏开始的时候  左侧额框框重新出现提示内容
};

//点击undo进行悔棋操作
Undo.onclick = function (e) {
    if (undo === true) {     //当undo为true时 可进行悔棋操作
        //实现悔棋的主要想法是先清空整个canvas 然后再依次绘制背景 跟所毁之棋的前面的棋子
        drawGrid(context, 31.25, 31.25);
        drawGrid(offcontext, 31.25, 31.25);
        drawblackcircle(context);
        drawblackcircle(offcontext);
        var xIndex = chessList[chessCount].x;
        var yIndex = chessList[chessCount].y;    //得到当前棋子的坐标
        data[xIndex][yIndex] = 0;                   //将棋盘数组里此坐标的元素设置为无棋状态
        chessCount--;                              //减少所下棋子数目
        player = 1;                                 //默认从黑棋开始
        for (var i = 1; i <= chessCount; i++) {       //从第一个棋子开始绘制 绘制完一个之后变换player达到改变下一个棋子的颜色
            drawPoint(context, player, chessList[i].x, chessList[i].y);
            drawPoint(offcontext, player, chessList[i].x, chessList[i].y);
            player *= -1;
        }
        //下面这个if else 是为了使左边的框框回到下所毁之棋前的状态
        if (player === 1) {
            Turn.style.color = "black";
            Turn.innerHTML = "Black's turn";
        } else {
            Turn.style.color = "white";
            Turn.innerHTML = "White's turn";
        }
        //当进行悔棋操作之后  棋子外围的红框框应该在所毁棋子的上一个棋子处
        if (chessCount > 0) {
            context.beginPath();
            context.strokeStyle = "red";
            context.strokeRect(31.25 * chessList[chessCount].x - 15.625, 31.25 * chessList[chessCount].y - 15.625, 31.25, 31.25);
        }
    } else  //在游戏结束时 undo被设置成false 不能在进行悔棋操作  出现对话框进行提醒
        alert("Gameover! You can't undo the pointer! ");
};


// Initialization................................................
//初始化画背景
image.src = 'gobang.png';
image.onload = function () {
    context.drawImage(image,0,0,canvas.width,canvas.height);
    offcontext.drawImage(image,0,0,canvas.width,canvas.height);
}