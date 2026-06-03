if (!customElements.get('count-down')) {
  customElements.define('count-down', class Countdown extends HTMLElement {
    constructor() {
      super();

      this.needReverseTime = false;
      if(!this.dataset.hasOwnTpl) {
        this.appendChild(document.getElementById('countdown-tpl').content.firstElementChild.cloneNode(true));
      }
      if(this.dataset.endtime) {
        this.initSingleCountdown();
      } else if(this.dataset.list) {
        this.initCountdownInList();
      } else {
        this.initFail();
      }
    }

    initSingleCountdown() {
      const pattern1 = /^\d{4}-\d{2}-\d{2}$/;
      const pattern2 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      const pattern3 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(\:\d{2}|)(\+|-)\d{4}/;
      const pattern4 = /^\d{2}:\d{2}$/;
      if(pattern1.test(this.dataset.endtime) || pattern2.test(this.dataset.endtime) || pattern3.test(this.dataset.endtime) || pattern4.test(this.dataset.endtime)) {
        var finalDate = this.dataset.endtime.replace(/-/g, '/');
        if(!pattern4.test(this.dataset.endtime)) {
          if(pattern1.test(this.dataset.endtime)) {
            finalDate += ' 00:00:00' + this.dataset.timezone;
          } else if(pattern2.test(this.dataset.endtime)) {
            finalDate += ':00' + this.dataset.timezone;
          }
          this.countDownDate = new Date(finalDate).getTime();
        } else {
          var expiredDate = new Date(this.dataset.reverseTime);
          const currentDate = new Date(this.dataset.nowTime);
          if(expiredDate.getTime() <= currentDate.getTime()) {
            expiredDate.setTime(expiredDate.getTime() + 24 * 60 * 60 * 1000);
          }
          this.countDownDate = expiredDate.getTime();
          this.needReverseTime = true;
        }
        this.initElements();
        this.interval = setInterval(this.run.bind(this), 1000);  
      } else {
        this.initFail();
      }
    }

    initCountdownInList() {
      const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(\:\d{2}|)(\+|-)\d{4}/;
      const dataList = this.dataset.list.split(',');
      const now = new Date();
      let min;
      dataList.forEach(value => {
        if(pattern.test(value)) {
          let countdownDate = new Date(value.replace(/-/g, '/'));
          if(countdownDate > now) {
            if(!min || countdownDate <= min) {
              min = countdownDate;
            }
          }
        }
      });
      if(min) {
        this.countDownDate = min.getTime();
        this.initElements();
        this.interval = setInterval(this.run.bind(this), 1000);
      } else {
        this.initFail();
      }
    }

    initElements() {
      this.daysElement = this.querySelector('.countdown__days__value');
      this.hoursElement = this.querySelector('.countdown__hours__value');
      this.minutesElement = this.querySelector('.countdown__minutes__value');
      this.secondsElement = this.querySelector('.countdown__seconds__value');
    }

    initFail() {
      if(Shopify.designMode) {
        this.showMessage(window.accessibilityStrings.countdownErrorMsg);
      } else {
        this.remove();
      }
    }

    run() {
      const now = new Date().getTime();

      // Find the distance between now and the count down date
      const distance = this.countDownDate - now;

      if(distance > 0) {
         // Time calculations for days, hours, minutes and seconds
        const daysNumber = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hoursNumber = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesNumber = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const secondsNumber = Math.floor((distance % (1000 * 60)) / 1000);
        if(!daysNumber) {
          this.daysElement.parentElement.classList.add('hidden');
        } else {
          this.daysElement.textContent = daysNumber;
        }

        if(!hoursNumber) {
          this.hoursElement.parentElement.classList.add('hidden');
        } else {
          this.hoursElement.textContent = hoursNumber;
        }

        this.minutesElement.textContent = minutesNumber;
        this.secondsElement.textContent = secondsNumber;
      } else {
        if(!this.needReverseTime) {
          clearInterval(this.interval);
          if(!this.dataset.hideAfterExpiry) {
            this.showMessage(this.dataset.expiredMsg ? this.dataset.expiredMsg : window.accessibilityStrings.countdownExpiredMsg);
            this.classList.add('expired');
          } else {
            this.remove();
          }
        } else {
          this.countDownDate += 24 * 60 * 60 * 1000;
        }
      }
    }

    showMessage(msg) {
      this.querySelectorAll(':scope > *').forEach((ele) => ele.remove());
      const node = document.createTextNode(msg);
      this.appendChild(node);
    }
  });
}