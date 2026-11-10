#include <stdio.h>
int checkout_total(int a){ return a*2; }
int main(int argc,char**argv){ printf("%d\n",checkout_total(argc)); return 0; }
