/**
 * cpu/swap/mem general usage
 * cpu: (grep 'cpu ' /proc/stat;sleep 0.1;grep 'cpu ' /proc/stat)|awk -v RS="" '{print "CPU "($13-$2+$15-$4)*100/($13-$2+$15-$4+$16-$5)"%"}'
 * mem/swap: free -h
 */
